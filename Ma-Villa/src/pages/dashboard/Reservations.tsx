import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Users, Check, X, CreditCard, Inbox, MessageSquare } from 'lucide-react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useConfig } from '../../context/ConfigContext'
import { useMessages } from '../../context/MessagesContext'
import { useToast } from '../../context/ToastContext'
import { useRequete } from '../../lib/useRequete'
import ListeConsole from '../../components/console/ListeConsole'
import { messageErreur } from '../../lib/erreurs'
import { fcfa, dateCourte, nuits } from '../../lib/format'
import Button, { ButtonLink } from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'

interface Reservation {
  id: number
  date_debut: string
  date_fin: string
  nb_personnes: number
  montant_total: number
  statut: 'en_attente' | 'confirmee' | 'annulee'
  client?: { name: string; email: string }
  logement: { nom: string; villa: { nom: string } }
  tarif: { type_tarif: string }
  paiement?: {
    statut: 'en_attente' | 'reussi' | 'echoue'
    reference: string | null
    paye_le: string | null
  } | null
}

const TARIF: Record<string, string> = {
  journee: 'Journée', nuitee: 'Nuitée', demi_journee: 'Demi-journée', pass: 'Pass',
}

/* Les statuts passent par le composant Badge, donc par les tokens. Les
   couleurs Tailwind écrites en dur ne suivaient pas le thème sombre. */
const STATUT: Record<Reservation['statut'], { label: string; ton: 'warning' | 'success' | 'danger' }> = {
  en_attente: { label: 'En attente', ton: 'warning' },
  confirmee: { label: 'Confirmée', ton: 'success' },
  annulee: { label: 'Annulée', ton: 'danger' },
}

const FILTRES = [
  { valeur: 'toutes', label: 'Toutes' },
  { valeur: 'en_attente', label: 'En attente' },
  { valeur: 'confirmee', label: 'Confirmées' },
  { valeur: 'annulee', label: 'Annulées' },
]

function dureeLisible(debut: string, fin: string) {
  const n = nuits(debut, fin)
  return n === 0 ? '1 jour' : `${n} nuit${n > 1 ? 's' : ''}`
}

/**
 * Une réservation reste à régler tant qu'elle n'est pas annulée et qu'aucun
 * paiement n'a abouti. C'est ici que le client revient : le tunnel n'était
 * atteignable que dans les secondes suivant la demande, sur la fiche de la
 * villa — passé cet écran, plus aucun chemin n'y menait.
 */
function resteARegler(r: Reservation, minimum: number) {
  return r.statut !== 'annulee'
    && r.paiement?.statut !== 'reussi'
    // Sous le plancher du prestataire, proposer « Régler » enverrait droit dans
    // un refus : mieux vaut ne rien proposer que promettre l'impossible.
    && r.montant_total >= minimum
}

export default function Reservations() {
  const { user } = useAuth()
  const { paiement } = useConfig()
  const { parReservation } = useMessages()
  const toast = useToast()
  const [filtre, setFiltre] = useState('toutes')
  const [enCours, setEnCours] = useState<number | null>(null)

  const estProprietaire = user?.role === 'proprietaire'

  const { donnees, chargement, erreur, reessayer } = useRequete<Reservation[]>(
    async (signal) => (await api.get('/reservations', { signal })).data,
    'reservations',
    { messageErreurParDefaut: 'Impossible de charger les réservations.' }
  )

  // Les demandes en attente d'abord : ce sont les seules qui réclament un geste.
  const ordre = { en_attente: 0, confirmee: 1, annulee: 2 }
  const toutes = [...(donnees ?? [])].sort((a, b) => ordre[a.statut] - ordre[b.statut])
  const liste = filtre === 'toutes' ? toutes : toutes.filter((r) => r.statut === filtre)
  const enAttente = toutes.filter((r) => r.statut === 'en_attente').length

  const changerStatut = async (r: Reservation, statut: 'confirmee' | 'annulee') => {
    setEnCours(r.id)
    try {
      await api.patch(`/reservations/${r.id}/statut`, { statut })
      toast.succes(
        statut === 'confirmee'
          ? `Réservation confirmée. ${r.client?.name ?? 'Le client'} en est prévenu.`
          : 'Réservation annulée.'
      )
      reessayer()
    } catch (err) {
      toast.erreur(messageErreur(err, "La décision n'a pas pu être enregistrée."))
    } finally {
      setEnCours(null)
    }
  }

  return (
    <div>
      <ListeConsole
        titre="Réservations"
        sousTitre={estProprietaire
          ? enAttente > 0
            ? `${enAttente} demande${enAttente > 1 ? 's' : ''} attend${enAttente > 1 ? 'ent' : ''} votre réponse.`
            : 'Aucune demande en attente.'
          : 'Vos séjours, et ce qu’il reste à régler.'}
        chargement={chargement}
        erreur={erreur}
        reessayer={reessayer}
        vide={liste.length === 0}
        videIcone={Inbox}
        videTexte={filtre === 'toutes'
          ? estProprietaire
            ? <>Aucune réservation pour l'instant. Elles apparaîtront ici dès qu'un client réservera.</>
            : <>Aucune réservation pour l'instant. Le séjour se réserve depuis la fiche d'une villa.</>
          : 'Aucune réservation dans cette catégorie.'}
        videAction={filtre === 'toutes' && !estProprietaire
          ? <ButtonLink to="/villas" variante="primaire" taille="sm">Parcourir les villas</ButtonLink>
          : undefined}
        outils={<div className="console-filtres">
        <div className="console-onglets" role="tablist">
          {FILTRES.map((f) => (
            <button
              key={f.valeur}
              role="tab"
              aria-selected={filtre === f.valeur}
              onClick={() => setFiltre(f.valeur)}
              className={`console-onglet${filtre === f.valeur ? ' est-actif' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>}
      >
        <div className="liste-console">
          {liste.map((r) => {
            const statut = STATUT[r.statut]
            const payable = paiement.actif && resteARegler(r, paiement.montant_minimum)
            const annulable = !estProprietaire && r.statut === 'en_attente'

            return (
              <article key={r.id} className={`panneau reservation est-${r.statut}`}>
                <div className="reservation-haut">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="reservation-villa">{r.logement.villa.nom}</p>
                    <p className="reservation-logement">
                      {r.logement.nom} · {TARIF[r.tarif.type_tarif] ?? r.tarif.type_tarif}
                    </p>
                  </div>
                  <Badge ton={statut.ton}>{statut.label}</Badge>
                </div>

                <ul className="reservation-faits">
                  <li>
                    <CalendarDays size={13} aria-hidden="true" />
                    {dateCourte(r.date_debut)} → {dateCourte(r.date_fin)}
                  </li>
                  <li>{dureeLisible(r.date_debut, r.date_fin)}</li>
                  <li>
                    <Users size={13} aria-hidden="true" />
                    {r.nb_personnes} pers.
                  </li>
                </ul>

                <div className="reservation-bas">
                  {r.client ? (
                    <p className="reservation-client">{r.client.name} · {r.client.email}</p>
                  ) : <span />}

                  <p className="reservation-montant">
                    {/* Le propriétaire doit voir aussi vite que le client si
                        l'argent est arrivé : c'est ce qui décide s'il remet
                        les clés. */}
                    {r.paiement?.statut === 'reussi' && (
                      <span className="reservation-paye">✓ Payé</span>
                    )}
                    {fcfa(r.montant_total)}
                  </p>
                </div>

                <div className="reservation-actions">
                  {/* Depuis que le numero du proprietaire a quitte la fiche
                      publique, c'est par ici que tout se demande. Le lien est
                      donc present sur chaque carte, y compris annulee : un
                      remboursement se discute apres coup. */}
                  <Link
                    to={`/dashboard/reservations/${r.id}/messages`}
                    className="btn btn-secondaire btn-sm"
                  >
                    <MessageSquare size={15} aria-hidden="true" />
                    <span>Messages</span>
                    {(parReservation[r.id] ?? 0) > 0 && (
                      <span className="console-pastille">{parReservation[r.id]}</span>
                    )}
                  </Link>

                  {estProprietaire && r.statut === 'en_attente' && (
                    <>
                      <Button
                        variante="primaire" taille="sm"
                        onClick={() => changerStatut(r, 'confirmee')}
                        disabled={enCours === r.id}
                        iconeAvant={<Check size={15} />}
                      >
                        Confirmer
                      </Button>
                      <Button
                        variante="secondaire" taille="sm"
                        onClick={() => changerStatut(r, 'annulee')}
                        disabled={enCours === r.id}
                        iconeAvant={<X size={15} />}
                      >
                        Refuser
                      </Button>
                    </>
                  )}

                  {annulable && (
                    <Button
                      variante="secondaire" taille="sm"
                      onClick={() => changerStatut(r, 'annulee')}
                      disabled={enCours === r.id}
                    >
                      Annuler la demande
                    </Button>
                  )}

                  {payable && (
                    <Link to={`/reservation/${r.id}/paiement`} className="btn btn-primaire btn-sm">
                      <CreditCard size={15} aria-hidden="true" />
                      <span>{r.paiement?.statut === 'en_attente' ? 'Reprendre le paiement' : 'Régler'}</span>
                    </Link>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </ListeConsole>
    </div>
  )
}
