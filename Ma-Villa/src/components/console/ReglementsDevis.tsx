import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Download, X } from 'lucide-react'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { useRequete } from '../../lib/useRequete'
import { erreursParChamp, messageErreur } from '../../lib/erreurs'
import { aujourdhui, dateCourte, fcfa } from '../../lib/format'
import { relireAttentes } from '../../lib/attentes'
import { aideReference, lienEnvoiRecu, type EtatReglements, type Reglement } from '../../lib/reglements'
import type { Devis } from '../../lib/devis'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import { Champ, ChampSelection, ChampZoneTexte } from '../ui/Champ'
import ConfirmModal from '../ConfirmModal'
import BoutonWhatsApp from '../BoutonWhatsApp'

interface Props {
  devis: Devis
  /** Le devis change avec l'argent (statut, verrou) : l'éditeur doit le relire. */
  onChange: () => void
}

type Geste =
  | { type: 'annuler'; reglement: Reglement }
  | { type: 'client' }
  | { type: 'clore' }

const VIDE = { montant: '', moyen: 'wave', recu_le: '', reference: '', payeur_telephone: '', note: '' }

/**
 * L'argent reçu sur un devis, hors du site.
 *
 * PasseTemps reçoit l'argent du client et en doit une part au propriétaire : ce qu'on
 * note ici alimente le même paiement que le site, donc le reversement et le remboursement.
 * Rien ne part d'ici et rien n'est débité : on constate une somme réellement reçue. L'écran
 * dit avant le geste ce qu'il change, car le premier règlement bloque les dates et prévient
 * le propriétaire.
 */
export default function ReglementsDevis({ devis, onChange }: Props) {
  const toast = useToast()
  const [geste, setGeste] = useState<Geste | null>(null)
  const [motif, setMotif] = useState('')
  const [gesteEnCours, setGesteEnCours] = useState(false)

  const { donnees: etat, chargement, erreur, reessayer } = useRequete<EtatReglements>(
    async (signal) => (await api.get(`/admin/devis/${devis.id}/reglements`, { signal })).data,
    `reglements-devis-${devis.id}`,
    { messageErreurParDefaut: 'Les règlements de ce devis n’ont pas pu être chargés.' },
  )

  const apresChangement = () => {
    reessayer()
    onChange()
    relireAttentes()
  }

  const confirmerGeste = async () => {
    if (!geste || motif.trim().length < 10) return
    setGesteEnCours(true)
    try {
      if (geste.type === 'annuler') {
        await api.post(`/admin/reglements/${geste.reglement.id}/annuler`, { motif: motif.trim() })
        toast.succes(`Reçu ${geste.reglement.numero} annulé.`)
      } else if (geste.type === 'client') {
        await api.post(`/admin/devis/${devis.id}/annulation`, { motif: motif.trim() })
        toast.succes('Demande enregistrée : elle attend votre décision dans « Remboursements ».')
      } else {
        await api.post(`/admin/devis/${devis.id}/clore-solde`, { motif: motif.trim() })
        toast.succes('Dossier clos au montant reçu.')
      }
      setGeste(null)
      setMotif('')
      apresChangement()
    } catch (err) {
      toast.erreur(messageErreur(err, 'Ce geste n’a pas pu être enregistré.'))
    } finally {
      setGesteEnCours(false)
    }
  }

  if (chargement && !etat) {
    return <section className="panneau reglements"><h2 className="panneau-titre">Règlements</h2><p className="tableau-second">Chargement…</p></section>
  }

  if (erreur || !etat) {
    return (
      <section className="panneau reglements">
        <h2 className="panneau-titre">Règlements</h2>
        <p className="console-erreur">{erreur ?? 'Les règlements de ce devis n’ont pas pu être chargés.'}</p>
        <div><Button variante="secondaire" taille="sm" onClick={reessayer}>Réessayer</Button></div>
      </section>
    )
  }

  const valides = etat.reglements.filter((r) => r.statut === 'valide')
  const reservation = etat.reservation
  const annulee = reservation?.statut === 'annulee'
  const enAttenteDeDecision = Boolean(reservation?.annulation_demandee_le) && !annulee
  const verrouille = etat.reparti || etat.rembourse > 0
  const sejourEnCours = Boolean(reservation) && !annulee && !enAttenteDeDecision
  const peutEncaisser = etat.manques.length === 0 && !annulee && !enAttenteDeDecision && etat.solde > 0
  const part = etat.total > 0 ? Math.min(100, Math.round((etat.encaisse / etat.total) * 100)) : 0

  return (
    <section className="panneau reglements" aria-labelledby="titre-reglements">
      <div className="reglements-tete">
        <h2 id="titre-reglements" className="panneau-titre">Règlements</h2>
        {etat.encaisse > 0 && etat.solde === 0 && !annulee && <Badge ton="success">Réglé</Badge>}
        {etat.encaisse > 0 && etat.solde > 0 && !annulee && <Badge ton="warning">Acompte reçu</Badge>}
        {annulee && <Badge ton="danger">Réservation annulée</Badge>}
      </div>

      <dl className="reglements-chiffres">
        <div><dt>Total</dt><dd>{fcfa(etat.total)}</dd></div>
        <div><dt>Encaissé</dt><dd>{fcfa(etat.encaisse)}</dd></div>
        <div><dt>Reste à payer</dt><dd className={etat.solde > 0 && etat.encaisse > 0 ? 'est-du' : undefined}>{fcfa(etat.solde)}</dd></div>
      </dl>

      {etat.encaisse > 0 && !annulee && (
        <div className="reglements-barre" role="progressbar" aria-label="Part du total encaissée" aria-valuemin={0} aria-valuemax={100} aria-valuenow={part}>
          <span style={{ width: `${part}%` }} />
        </div>
      )}

      {etat.repartition && etat.manques.length === 0 && (
        <p className="tableau-second">
          Quand tout sera réglé : {fcfa(etat.repartition.commission)} pour PasseTemps ({etat.repartition.taux}) et{' '}
          {fcfa(etat.repartition.proprietaire)} {etat.repartition.circuit === 'associe' ? 'pour le propriétaire, par les associés' : 'pour le propriétaire'}.
          Cette répartition n’apparaît que dans la console.
        </p>
      )}

      {etat.manques.length > 0 && !annulee && (
        <p className="reglements-note">
          Pour encaisser, ce devis doit indiquer {etat.manques.join(', ')}. Sans cela, on ne sait ni quel séjour bloquer, ni à qui reverser.
          Complétez-le ci-dessous, enregistrez, et cet encadré laissera place au formulaire.
        </p>
      )}

      {annulee && (
        <p className="reglements-note">
          Cette réservation est annulée{etat.rembourse > 0 ? ` : ${fcfa(etat.rembourse)} rendus au client` : ''}. Pour un nouveau séjour, établissez un nouveau devis.
        </p>
      )}

      {enAttenteDeDecision && (
        <p className="reglements-note">
          Le client renonce à son séjour. Les dates restent bloquées jusqu’à votre décision,{' '}
          <Link to="/admin/remboursements" className="underline underline-offset-2">dans « Remboursements »</Link>.
        </p>
      )}

      {peutEncaisser && (
        <FormulaireReglement
          key={`${etat.solde}-${valides.length}`}
          devisId={devis.id}
          solde={etat.solde}
          premier={valides.length === 0}
          moyens={etat.moyens}
          onEnregistre={apresChangement}
        />
      )}

      {etat.reglements.length > 0 && (
        <ul className="reglements-liste">
          {etat.reglements.map((r) => {
            const envoiRecu = r.statut === 'valide' ? lienEnvoiRecu(r, r.payeur_telephone ?? devis.client_telephone) : null
            return (
              <li key={r.id} className={r.statut === 'annule' ? 'est-annule' : undefined}>
                <div className="reglements-ligne">
                  <p className="tableau-fort">
                    <span className="reglements-somme">{fcfa(r.montant)}</span> · {r.libelle_moyen}
                    {r.statut === 'annule' && <> · <Badge ton="danger">Annulé</Badge></>}
                  </p>
                  <p className="tableau-second">
                    {r.numero} · reçu le {dateCourte(r.recu_le, 'fr')}
                    {r.reference ? ` · réf. ${r.reference}` : ''} · noté par {r.createur_nom}
                  </p>
                  {r.note && <p className="tableau-second">{r.note}</p>}
                  {r.statut === 'annule' && r.annule_motif && (
                    <p className="tableau-second">Annulé par {r.annule_par_nom} : {r.annule_motif}</p>
                  )}
                </div>
                <div className="reservation-actions">
                  <a href={r.pdf} target="_blank" rel="noopener noreferrer" className="btn btn-secondaire btn-sm">
                    <Download size={15} aria-hidden="true" />
                    <span>Reçu</span>
                  </a>
                  {envoiRecu && <BoutonWhatsApp href={envoiRecu} taille="sm">Envoyer</BoutonWhatsApp>}
                  {r.statut === 'valide' && !verrouille && (
                    <Button variante="discret" taille="sm" onClick={() => { setGeste({ type: 'annuler', reglement: r }); setMotif('') }}>
                      Annuler
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {verrouille && valides.length > 0 && (
        <p className="tableau-second">L’argent de ce dossier est reparti : ces reçus ne s’annulent plus.</p>
      )}

      {sejourEnCours && (
        <div className="reglements-gestes">
          <Button variante="secondaire" taille="sm" onClick={() => { setGeste({ type: 'client' }); setMotif('') }}>Le client annule</Button>
          {etat.encaisse > 0 && etat.solde > 0 && (
            <Button variante="discret" taille="sm" onClick={() => { setGeste({ type: 'clore' }); setMotif('') }}>Clore au montant reçu</Button>
          )}
        </div>
      )}

      {geste && (
        <>
          <div className="console-voile" onClick={() => { if (!motif.trim() && !gesteEnCours) setGeste(null) }} aria-hidden="true" />
          <div className="modale" role="dialog" aria-modal="true" aria-labelledby="titre-geste-reglement">
            <div className="modale-entete">
              <h2 id="titre-geste-reglement" className="panneau-titre" style={{ margin: 0 }}>
                {geste.type === 'annuler' && `Annuler le reçu ${geste.reglement.numero}`}
                {geste.type === 'client' && 'Le client renonce à son séjour'}
                {geste.type === 'clore' && 'Clore au montant reçu'}
              </h2>
              <Button variante="discret" taille="sm" onClick={() => setGeste(null)} iconeAvant={<X size={18} />} aria-label="Fermer" />
            </div>

            <p className="console-sous-titre">
              {geste.type === 'annuler' && (valides.length === 1
                ? 'C’est le seul règlement de ce dossier : la réservation est annulée et les dates sont rendues au calendrier. '
                : `Le reste à payer remonte de ${fcfa(geste.reglement.montant)}. `)}
              {geste.type === 'annuler' && 'Le reçu porte la mention « annulé » et son numéro reste pris. Ce geste est fait pour une erreur de saisie : si l’argent a bien été reçu et que le client renonce, utilisez « Le client annule ».'}
              {geste.type === 'client' && 'La réservation reste confirmée et les dates restent bloquées jusqu’à la décision. La demande part dans « Remboursements », où le barème propose un montant et où vous tranchez.'}
              {geste.type === 'clore' && `Le client ne paiera pas les ${fcfa(etat.solde)} restants. Le dossier s’arrête à ${fcfa(etat.encaisse)} : la commission se recalcule sur ce montant, et la part du propriétaire lui sera due après le séjour. Aucun règlement ne pourra plus s’y ajouter.`}
            </p>

            <div className="modale-formulaire">
              <ChampZoneTexte
                label={geste.type === 'annuler' ? 'Pourquoi l’annuler ?' : geste.type === 'client' ? 'Qu’a dit le client ?' : 'Pourquoi le reste ne sera-t-il pas payé ?'}
                aide="Gardé au journal. Dix caractères au moins."
                rows={3}
                maxLength={500}
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
              />
            </div>

            <div className="modale-actions">
              <Button variante="secondaire" onClick={() => setGeste(null)} disabled={gesteEnCours}>Revenir</Button>
              <Button variante={geste.type === 'annuler' ? 'danger' : 'primaire'} onClick={confirmerGeste} chargement={gesteEnCours} disabled={motif.trim().length < 10}>
                {geste.type === 'annuler' ? 'Annuler le reçu' : geste.type === 'client' ? 'Envoyer aux remboursements' : 'Clore le dossier'}
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

interface PropsFormulaire {
  devisId: number
  solde: number
  premier: boolean
  moyens: Record<string, string>
  onEnregistre: () => void
}

/** À part, et remis à zéro par sa clé : la somme proposée est toujours ce qui reste à payer. */
function FormulaireReglement({ devisId, solde, premier, moyens, onEnregistre }: PropsFormulaire) {
  const toast = useToast()
  const [form, setForm] = useState(() => ({ ...VIDE, recu_le: aujourdhui(), montant: String(solde) }))
  const [erreurs, setErreurs] = useState<Record<string, string>>({})
  const [envoi, setEnvoi] = useState(false)
  const [doublon, setDoublon] = useState<string | null>(null)

  const maj = (cle: keyof typeof VIDE) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [cle]: e.target.value }))

  const montantSaisi = Number(form.montant) || 0

  const enregistrer = async (confirmer: boolean) => {
    setErreurs({})
    setEnvoi(true)
    try {
      const { data } = await api.post(`/admin/devis/${devisId}/reglements`, {
        montant: montantSaisi,
        moyen: form.moyen,
        recu_le: form.recu_le,
        reference: form.reference.trim() || null,
        payeur_telephone: form.payeur_telephone.trim() || null,
        note: form.note.trim() || null,
        ...(confirmer ? { confirmer: true } : {}),
      })
      toast.succes(`Reçu ${data.numero} établi.`)
      setDoublon(null)
      onEnregistre()
    } catch (err) {
      const reponse = (err as { response?: { data?: { doublon?: string } } }).response?.data
      if (reponse?.doublon) {
        setDoublon(reponse.doublon)
      } else {
        setDoublon(null)
        setErreurs(erreursParChamp(err))
        toast.erreur(messageErreur(err, 'Le règlement n’a pas pu être enregistré.'))
      }
    } finally {
      setEnvoi(false)
    }
  }

  const soumettre = (e: FormEvent) => {
    e.preventDefault()
    void enregistrer(false)
  }

  return (
    <form onSubmit={soumettre} noValidate className="reglements-form">
      {doublon && (
        <ConfirmModal
          message="Une seconde somme identique ?"
          detail={`Le reçu ${doublon} porte déjà le même montant, le même moyen et la même date. Enregistrez seulement si le client a vraiment payé deux fois.`}
          confirmLabel="Oui, c’est une seconde somme"
          onConfirm={() => { void enregistrer(true) }}
          onCancel={() => setDoublon(null)}
        />
      )}

      <div className="reglements-champs">
        <Champ
          label="Somme reçue (FCFA)"
          inputMode="numeric"
          value={form.montant}
          onChange={(e) => setForm((f) => ({ ...f, montant: e.target.value.replace(/\D/g, '') }))}
          erreur={erreurs.montant}
          required
        />
        <ChampSelection label="Moyen" value={form.moyen} onChange={maj('moyen')} erreur={erreurs.moyen}>
          {Object.entries(moyens).map(([cle, nom]) => <option key={cle} value={cle}>{nom}</option>)}
        </ChampSelection>
        <Champ label="Reçu le" type="date" max={aujourdhui()} value={form.recu_le} onChange={maj('recu_le')} erreur={erreurs.recu_le} required />
        <Champ label="Référence (facultatif)" value={form.reference} onChange={maj('reference')} erreur={erreurs.reference} aide={aideReference(form.moyen)} />
        <Champ label="Numéro du payeur (facultatif)" type="tel" inputMode="tel" value={form.payeur_telephone} onChange={maj('payeur_telephone')} erreur={erreurs.payeur_telephone} aide="S’il diffère de celui du client : c’est là qu’un remboursement se renverrait." />
        <Champ label="Note (facultatif)" value={form.note} onChange={maj('note')} erreur={erreurs.note} />
      </div>

      <p className="tableau-second" aria-live="polite">
        {premier
          ? 'Ce premier règlement confirme la réservation : les dates sont bloquées et le propriétaire est prévenu.'
          : montantSaisi >= solde
            ? 'Ce règlement solde le dossier : la part du propriétaire lui sera due après le séjour.'
            : `Il restera ${fcfa(Math.max(0, solde - montantSaisi))} à recevoir.`}
      </p>

      <div>
        <Button type="submit" variante="primaire" taille="sm" chargement={envoi} disabled={montantSaisi <= 0 || !form.recu_le}>
          Enregistrer et établir le reçu
        </Button>
      </div>
    </form>
  )
}
