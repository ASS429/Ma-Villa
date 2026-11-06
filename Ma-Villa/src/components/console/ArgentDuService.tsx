import { useState, type FormEvent } from 'react'
import { HandCoins, Send } from 'lucide-react'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { erreursParChamp, messageErreur } from '../../lib/erreurs'
import { aujourdhui, dateCourte, fcfa } from '../../lib/format'
import { relireAttentes } from '../../lib/attentes'
import { aideReference } from '../../lib/reglements'
import type { DemandeService } from '../../types'
import Button from '../ui/Button'
import { Champ, ChampSelection } from '../ui/Champ'
import ConfirmModal from '../ConfirmModal'

/** Les moyens du serveur (`Reglement::MOYENS`), sans le chèque : un trajet ne se paie pas ainsi. */
const MOYENS: Record<string, string> = {
  wave: 'Wave',
  orange_money: 'Orange Money',
  especes: 'Espèces',
  virement: 'Virement bancaire',
  autre: 'Autre',
}

interface Props {
  demande: DemandeService
  onChange: () => void
}

const chiffres = (v: string) => v.replace(/\D/g, '')

/**
 * L'argent d'une demande de service : PasseTemps encaisse, puis reverse au
 * prestataire (décision du 6 novembre 2026). Rien ne part d'ici : l'écran
 * constate ce que l'équipe a reçu et versé, à la main.
 *
 * La part du prestataire suit la somme saisie (moins notre commission habituelle)
 * tant qu'on ne la corrige pas : une autre ville se paie plus cher, la
 * commission reste la même.
 */
export default function ArgentDuService({ demande: d, onChange }: Props) {
  const toast = useToast()
  const e = d.encaissement ?? null
  const r = d.repartition ?? null
  const [geste, setGeste] = useState<'encaisser' | 'reverser' | null>(null)
  const [aDefaire, setADefaire] = useState<'encaissement' | 'reversement' | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [erreurs, setErreurs] = useState<Record<string, string>>({})

  const [montant, setMontant] = useState(r ? String(r.prix) : '')
  const [part, setPart] = useState(r ? String(r.prix_prestataire) : '')
  const [partTouchee, setPartTouchee] = useState(false)
  const [moyen, setMoyen] = useState('wave')
  const [recuLe, setRecuLe] = useState(aujourdhui())
  const [reference, setReference] = useState('')
  const [reverseLe, setReverseLe] = useState(aujourdhui())
  const [referenceReversement, setReferenceReversement] = useState('')

  // Seul le transport a un prestataire attitré : le bloc n'existe que là, ou sur une
  // demande déjà payée.
  if (!e && (!r || d.statut === 'abandonnee')) return null

  const qui = e?.prestataire || r?.prestataire || 'le prestataire'
  const montantSaisi = Number(montant) || 0
  const partSaisie = Number(part) || 0

  const changerMontant = (v: string) => {
    const propre = chiffres(v)
    setMontant(propre)
    if (!partTouchee && r) setPart(propre ? String(Math.max(0, Number(propre) - r.commission)) : '')
  }

  const appeler = async (requete: () => Promise<unknown>, succes: string, echec: string) => {
    setEnvoi(true)
    setErreurs({})
    try {
      await requete()
      toast.succes(succes)
      setGeste(null)
      setADefaire(null)
      onChange()
      relireAttentes()
    } catch (err) {
      setErreurs(erreursParChamp(err))
      toast.erreur(messageErreur(err, echec))
    } finally {
      setEnvoi(false)
    }
  }

  const encaisser = (ev: FormEvent) => {
    ev.preventDefault()
    void appeler(
      () => api.post(`/admin/demandes-service/${d.id}/encaissement`, {
        montant: montantSaisi,
        part_prestataire: partSaisie,
        moyen,
        recu_le: recuLe,
        reference: reference.trim() || null,
      }),
      `${d.reference} : ${fcfa(montantSaisi)} enregistrés.`,
      'Le paiement n’a pas pu être enregistré.',
    )
  }

  const reverser = (ev: FormEvent) => {
    ev.preventDefault()
    void appeler(
      () => api.post(`/admin/demandes-service/${d.id}/reversement`, {
        reverse_le: reverseLe,
        reference: referenceReversement.trim() || null,
      }),
      `${d.reference} : part reversée à ${qui}.`,
      'Le reversement n’a pas pu être enregistré.',
    )
  }

  const defaire = () => {
    if (!aDefaire) return
    void appeler(
      () => api.delete(`/admin/demandes-service/${d.id}/${aDefaire}`),
      aDefaire === 'encaissement' ? `${d.reference} : paiement annulé.` : `${d.reference} : reversement annulé.`,
      'L’annulation n’a pas pu être enregistrée.',
    )
  }

  return (
    <section className="argent-service" aria-label="Argent de la demande">
      {aDefaire && (
        <ConfirmModal
          message={aDefaire === 'encaissement' ? 'Annuler le paiement enregistré ?' : 'Annuler le reversement enregistré ?'}
          detail={aDefaire === 'encaissement'
            ? 'À faire seulement pour une erreur de saisie : la demande redevient sans paiement. Si le client a vraiment payé et renonce, rendez-lui d’abord l’argent.'
            : `La part de ${qui} redevient à reverser, et à garder de côté d’ici là.`}
          confirmLabel="Oui, annuler"
          danger
          onConfirm={defaire}
          onCancel={() => setADefaire(null)}
        />
      )}

      {!e && geste !== 'encaisser' && (
        <div className="argent-service-actions">
          <Button variante="secondaire" taille="sm" iconeAvant={<HandCoins size={15} aria-hidden="true" />} onClick={() => setGeste('encaisser')}>
            Le client a payé
          </Button>
        </div>
      )}

      {!e && geste === 'encaisser' && (
        <form onSubmit={encaisser} noValidate className="reglements-form">
          <div className="reglements-champs">
            <Champ label="Somme reçue (FCFA)" inputMode="numeric" value={montant} onChange={(ev) => changerMontant(ev.target.value)} erreur={erreurs.montant} required />
            <Champ
              label={`Part de ${qui} (FCFA)`}
              inputMode="numeric"
              value={part}
              onChange={(ev) => { setPart(chiffres(ev.target.value)); setPartTouchee(true) }}
              erreur={erreurs.part_prestataire}
            />
            <ChampSelection label="Moyen" value={moyen} onChange={(ev) => setMoyen(ev.target.value)} erreur={erreurs.moyen}>
              {Object.entries(MOYENS).map(([cle, nom]) => <option key={cle} value={cle}>{nom}</option>)}
            </ChampSelection>
            <Champ label="Reçu le" type="date" max={aujourdhui()} value={recuLe} onChange={(ev) => setRecuLe(ev.target.value)} erreur={erreurs.recu_le} required />
            <Champ label="Référence (facultatif)" value={reference} onChange={(ev) => setReference(ev.target.value)} erreur={erreurs.reference} aide={aideReference(moyen)} />
          </div>
          <p className="tableau-second" aria-live="polite">
            {partSaisie > montantSaisi
              ? 'La part du prestataire dépasse la somme reçue.'
              : `Commission : ${fcfa(montantSaisi - partSaisie)}. Les ${fcfa(partSaisie)} de ${qui} restent à garder de côté jusqu’à ce que vous les lui reversiez.`}
          </p>
          <div className="argent-service-actions">
            <Button type="submit" variante="primaire" taille="sm" chargement={envoi} disabled={montantSaisi <= 0 || !recuLe || partSaisie > montantSaisi}>
              Enregistrer le paiement
            </Button>
            <Button type="button" variante="discret" taille="sm" onClick={() => { setGeste(null); setErreurs({}) }}>Annuler</Button>
          </div>
        </form>
      )}

      {e && (
        <>
          <p className="argent-service-ligne">
            <strong>{fcfa(e.montant)} reçus</strong> par {e.libelle_moyen} le {dateCourte(e.encaisse_le)}
            {e.reference ? ` (réf. ${e.reference})` : ''} · commission {fcfa(e.commission)}
          </p>
          <p className="argent-service-ligne">
            {e.reverse_le
              ? <>{fcfa(e.part_prestataire)} reversés à {qui} le {dateCourte(e.reverse_le)}{e.reference_reversement ? ` (réf. ${e.reference_reversement})` : ''}</>
              : <><strong>{fcfa(e.part_prestataire)} à reverser à {qui}</strong>, une fois le trajet fait</>}
          </p>

          {geste === 'reverser' && !e.reverse_le ? (
            <form onSubmit={reverser} noValidate className="reglements-form">
              <div className="reglements-champs">
                <Champ label="Reversé le" type="date" min={e.encaisse_le} max={aujourdhui()} value={reverseLe} onChange={(ev) => setReverseLe(ev.target.value)} erreur={erreurs.reverse_le} required />
                <Champ label="Référence (facultatif)" value={referenceReversement} onChange={(ev) => setReferenceReversement(ev.target.value)} erreur={erreurs.reference} aide="Le numéro de transaction de votre envoi." />
              </div>
              <div className="argent-service-actions">
                <Button type="submit" variante="primaire" taille="sm" chargement={envoi} disabled={!reverseLe}>
                  Enregistrer le reversement
                </Button>
                <Button type="button" variante="discret" taille="sm" onClick={() => { setGeste(null); setErreurs({}) }}>Annuler</Button>
              </div>
            </form>
          ) : (
            <div className="argent-service-actions">
              {!e.reverse_le && (
                <Button variante="primaire" taille="sm" iconeAvant={<Send size={15} aria-hidden="true" />} onClick={() => setGeste('reverser')}>
                  Reversé à {qui}
                </Button>
              )}
              <Button variante="discret" taille="sm" disabled={envoi} onClick={() => setADefaire(e.reverse_le ? 'reversement' : 'encaissement')}>
                {e.reverse_le ? 'Annuler le reversement' : 'Annuler ce paiement'}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
