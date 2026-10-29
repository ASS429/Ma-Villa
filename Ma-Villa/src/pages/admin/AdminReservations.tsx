import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, HandCoins } from 'lucide-react'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { useRequete } from '../../lib/useRequete'
import { messageErreur } from '../../lib/erreurs'
import { dateCourte, depuis, fcfa, periode } from '../../lib/format'
import { relireAttentes } from '../../lib/attentes'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import ListeConsole from '../../components/console/ListeConsole'

interface Demande {
  id: number
  villa: string | null
  villa_id: number | null
  lieu: string
  logement: string | null
  proprietaire: string | null
  client: string | null
  date_debut: string
  date_fin: string
  nb_personnes: number
  montant_total: number
  demandee_le: string
  expire_le: string
}

interface Transmission {
  id: number
  reservation_id: number
  villa: string | null
  logement: string | null
  proprietaire: string | null
  client: string | null
  date_debut: string
  date_fin: string
  methode: string
  paye_le: string | null
  montant: number
  montant_proprietaire: number
  commission: number
  part_passetemps: number
  a_transmettre: number
  transmis_le: string | null
  transmis_montant: number | null
  transmis_reference: string | null
  transmis_par: string | null
}

interface Transmissions {
  a_transmettre: Transmission[]
  transmis: Transmission[]
  totaux: { a_transmettre: number; part_passetemps: number }
}

const ONGLETS = [
  { valeur: 'demandes', label: 'Demandes' },
  { valeur: 'transmettre', label: 'À transmettre' },
  { valeur: 'transmis', label: 'Transmis' },
] as const

type Onglet = (typeof ONGLETS)[number]['valeur']

/** Heures entières qui restent avant l'annulation automatique. */
function heuresRestantes(iso: string): number {
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 3_600_000))
}

/**
 * Les réservations pendant les JOJ.
 *
 * **Demandes** : sur un compte que personne n'ouvre (Clé d'Or, tenu par un
 * associé), une demande n'était vue par personne et s'annulait seule au bout
 * du délai. On vérifie avec le gérant hébergement, puis on répond ici.
 *
 * **À transmettre** : sur le circuit des associés, leur part leur revient à
 * chaque paiement — le prix du propriétaire et 90 % de notre majoration. Le
 * retrait se fait chez PayDunya ; l'écran enregistre ce qui est vraiment
 * parti, frais déduits.
 */
export default function AdminReservations() {
  const toast = useToast()
  const [onglet, setOnglet] = useState<Onglet>('demandes')
  const [enCours, setEnCours] = useState<number | null>(null)
  const [saisies, setSaisies] = useState<Record<number, { montant: string; reference: string }>>({})

  const demandes = useRequete<{ demandes: Demande[]; delai_heures: number }>(
    async (signal) => (await api.get('/admin/reservations', { signal })).data,
    'admin-reservations-demandes',
    { messageErreurParDefaut: 'Impossible de charger les demandes.' }
  )

  const transmissions = useRequete<Transmissions>(
    async (signal) => (await api.get('/admin/transmissions', { signal })).data,
    'admin-reservations-transmissions',
    { messageErreurParDefaut: 'Impossible de charger les transmissions.' }
  )

  const repondre = async (d: Demande, statut: 'confirmee' | 'annulee') => {
    const question = statut === 'confirmee'
      ? `Confirmer la demande pour ${d.villa} (${periode(d.date_debut, d.date_fin)}) ? Le client pourra payer.`
      : `Refuser la demande pour ${d.villa} ? Le client en est prévenu.`
    if (!window.confirm(question)) return

    setEnCours(d.id)
    try {
      await api.patch(`/reservations/${d.id}/statut`, { statut })
      toast.succes(statut === 'confirmee' ? 'Demande confirmée : le client peut payer.' : 'Demande refusée.')
      demandes.reessayer()
      relireAttentes()
    } catch (err) {
      toast.erreur(messageErreur(err, "La demande n'a pas pu être mise à jour."))
    } finally {
      setEnCours(null)
    }
  }

  const saisie = (t: Transmission) => saisies[t.id] ?? { montant: String(t.a_transmettre), reference: '' }

  const noter = async (t: Transmission) => {
    const { montant, reference } = saisie(t)
    const valeur = Number(montant.replace(/\s/g, ''))
    if (!Number.isInteger(valeur) || valeur <= 0) {
      toast.erreur('Indiquez le montant parti, en francs.')
      return
    }
    if (!window.confirm(`Noter ${fcfa(valeur)} transmis aux associés pour ${t.villa} ?`)) return

    setEnCours(t.id)
    try {
      await api.patch(`/admin/paiements/${t.id}/transmission`, { montant: valeur, reference: reference || null })
      toast.succes('Transmission enregistrée.')
      transmissions.reessayer()
      relireAttentes()
    } catch (err) {
      toast.erreur(messageErreur(err, "La transmission n'a pas pu être enregistrée."))
    } finally {
      setEnCours(null)
    }
  }

  const requete = onglet === 'demandes' ? demandes : transmissions
  const listeDemandes = demandes.donnees?.demandes ?? []
  const aTransmettre = transmissions.donnees?.a_transmettre ?? []
  const transmis = transmissions.donnees?.transmis ?? []
  const totaux = transmissions.donnees?.totaux

  const vide = onglet === 'demandes'
    ? listeDemandes.length === 0
    : (onglet === 'transmettre' ? aTransmettre : transmis).length === 0

  return (
    <div>
      <ListeConsole
        titre="Réservations"
        sousTitre={onglet === 'demandes'
          ? <>Les demandes qui attendent une réponse. Sans réponse sous {demandes.donnees?.delai_heures ?? 24} h,
            elles s'annulent seules : pour une annonce tenue par un associé, vérifiez avec le gérant
            hébergement, puis confirmez ou refusez.</>
          : <>Sur les annonces des associés, leur part leur revient à chaque paiement : tout, sauf
            les 10 % de notre majoration qui restent à PasseTemps. Faites le retrait chez PayDunya,
            puis notez ici ce qui est parti, frais déduits.
            {totaux && <> Part de PasseTemps encaissée : <strong>{fcfa(totaux.part_passetemps)}</strong>.</>}</>}
        chargement={requete.chargement}
        erreur={requete.erreur}
        reessayer={requete.reessayer}
        vide={vide}
        videIcone={onglet === 'demandes' ? CalendarCheck : HandCoins}
        videTexte={onglet === 'demandes'
          ? 'Aucune demande en attente.'
          : onglet === 'transmettre' ? 'Rien à transmettre.' : 'Aucune transmission enregistrée.'}
        outils={<div className="console-filtres">
          <div className="console-onglets" role="tablist">
            {ONGLETS.map((o) => (
              <button
                key={o.valeur}
                role="tab"
                aria-selected={onglet === o.valeur}
                className={`console-onglet${onglet === o.valeur ? ' est-actif' : ''}`}
                onClick={() => setOnglet(o.valeur)}
              >
                {o.label}
                {o.valeur === 'demandes' && listeDemandes.length > 0 ? ` (${listeDemandes.length})` : ''}
                {o.valeur === 'transmettre' && aTransmettre.length > 0 ? ` (${aTransmettre.length})` : ''}
              </button>
            ))}
          </div>
        </div>}
      >
        {onglet === 'demandes' && (
          <div className="liste-console">
            {listeDemandes.map((d) => {
              const restant = heuresRestantes(d.expire_le)
              return (
                <article key={d.id} className="panneau commande-admin">
                  <div className="commande-admin-haut">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="tableau-fort">
                        {d.villa_id ? <Link to={`/hebergements/${d.villa_id}/`} className="underline underline-offset-2">{d.villa}</Link> : d.villa}
                        {d.logement ? ` · ${d.logement}` : ''}
                      </p>
                      <p className="tableau-second">{d.lieu} · demandée {depuis(d.demandee_le)}</p>
                    </div>
                    <div className="commande-ligne-droite">
                      <Badge ton={restant <= 6 ? 'danger' : 'warning'}>
                        {restant > 0 ? `Annulée dans ${restant} h` : "S'annule bientôt"}
                      </Badge>
                    </div>
                  </div>

                  <dl className="commande-admin-faits">
                    <div><dt>Séjour</dt><dd>{periode(d.date_debut, d.date_fin)} · {d.nb_personnes} pers.</dd></div>
                    <div><dt>Montant</dt><dd>{fcfa(d.montant_total)}</dd></div>
                    <div><dt>Client</dt><dd>{d.client ?? '—'}</dd></div>
                    <div><dt>Propriétaire</dt><dd>{d.proprietaire ?? '—'}</dd></div>
                  </dl>

                  <div className="reservation-actions">
                    <Button variante="primaire" taille="sm" disabled={enCours === d.id} onClick={() => repondre(d, 'confirmee')}>
                      Confirmer
                    </Button>
                    <Button variante="discret" taille="sm" disabled={enCours === d.id} onClick={() => repondre(d, 'annulee')}>
                      Refuser
                    </Button>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {onglet !== 'demandes' && (
          <div className="liste-console">
            {(onglet === 'transmettre' ? aTransmettre : transmis).map((t) => (
              <article key={t.id} className="panneau commande-admin">
                <div className="commande-admin-haut">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="tableau-fort">{t.villa}{t.logement ? ` · ${t.logement}` : ''}</p>
                    <p className="tableau-second">
                      {t.client ?? '—'} · {periode(t.date_debut, t.date_fin)}
                      {t.paye_le ? ` · payé le ${dateCourte(t.paye_le)}` : ''}
                    </p>
                  </div>
                  <div className="commande-ligne-droite">
                    {t.transmis_le
                      ? <Badge ton="success">Transmis le {dateCourte(t.transmis_le)}</Badge>
                      : <Badge ton="warning">{fcfa(t.a_transmettre)} à transmettre</Badge>}
                  </div>
                </div>

                <dl className="commande-admin-faits">
                  <div><dt>Payé par le client</dt><dd>{fcfa(t.montant)} ({t.methode})</dd></div>
                  <div><dt>Prix du propriétaire</dt><dd>{fcfa(t.montant_proprietaire)}{t.proprietaire ? ` · ${t.proprietaire}` : ''}</dd></div>
                  <div><dt>Majoration</dt><dd>{fcfa(t.commission)}, dont {fcfa(t.part_passetemps)} pour PasseTemps</dd></div>
                  {t.transmis_le && (
                    <div>
                      <dt>Parti</dt>
                      <dd>
                        {fcfa(t.transmis_montant)}
                        {t.transmis_reference ? ` · réf. ${t.transmis_reference}` : ''}
                        {t.transmis_par ? ` · noté par ${t.transmis_par}` : ''}
                      </dd>
                    </div>
                  )}
                </dl>

                {!t.transmis_le && (
                  <div className="reservation-actions flex flex-wrap items-end gap-3">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs th-text-2">Montant parti (F)</span>
                      <input
                        inputMode="numeric"
                        value={saisie(t).montant}
                        onChange={(e) => setSaisies((s) => ({ ...s, [t.id]: { ...saisie(t), montant: e.target.value } }))}
                        className="champ-controle"
                        style={{ width: 140 }}
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs th-text-2">Référence (facultatif)</span>
                      <input
                        value={saisie(t).reference}
                        maxLength={120}
                        onChange={(e) => setSaisies((s) => ({ ...s, [t.id]: { ...saisie(t), reference: e.target.value } }))}
                        className="champ-controle"
                        style={{ width: 180 }}
                      />
                    </label>
                    <Button variante="primaire" taille="sm" disabled={enCours === t.id} onClick={() => noter(t)}>
                      Noter la transmission
                    </Button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </ListeConsole>
    </div>
  )
}
