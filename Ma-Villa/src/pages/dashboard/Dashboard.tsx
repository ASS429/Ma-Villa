import { Link } from 'react-router-dom'
import {
  CalendarDays, Heart, Home, Clock, Plus, Building2, Wallet,
  CreditCard, AlertTriangle, ArrowRight, Compass,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import { useRequete } from '../../lib/useRequete'
import { fcfaCourt, dateCourte } from '../../lib/format'
import { ButtonLink } from '../../components/ui/Button'

interface Reservation {
  id: number
  statut: 'en_attente' | 'confirmee' | 'annulee'
  date_debut: string
  date_fin: string
  montant_total: number | string
  logement?: { nom: string; villa?: { nom: string } }
  paiement?: { statut: string } | null
}

interface Villa {
  id: number
  statut: string
}

/* ── Briques ─────────────────────────────────────────────────── */

function Chiffre({
  Icone, libelle, valeur, detail, action,
}: {
  Icone: typeof Home
  libelle: string
  valeur: string | number
  detail?: string
  action?: boolean
}) {
  return (
    <article className={`chiffre${action ? ' demande-action' : ''}`}>
      <div className="chiffre-haut">
        <span className="chiffre-icone" aria-hidden="true"><Icone size={16} /></span>
      </div>
      <p className="chiffre-valeur">{valeur}</p>
      <p className="chiffre-libelle">{libelle}</p>
      {detail && <p className="chiffre-detail">{detail}</p>}
    </article>
  )
}

function Raccourci({
  to, Icone, titre, detail,
}: {
  to: string
  Icone: typeof Home
  titre: string
  detail: string
}) {
  return (
    <Link to={to} className="panneau raccourci">
      <span className="chiffre-icone" aria-hidden="true"><Icone size={16} /></span>
      <span className="raccourci-texte">
        <span className="raccourci-titre">{titre}</span>
        <span className="raccourci-detail">{detail}</span>
      </span>
      <ArrowRight size={16} className="raccourci-fleche" aria-hidden="true" />
    </Link>
  )
}

/** Bandeau d'action, en tête d'écran : ce qui attend quelqu'un passe avant les chiffres. */
function Alerte({ titre, detail, lien, libelleLien }: { titre: string; detail: string; lien: string; libelleLien: string }) {
  return (
    <div className="panneau alerte-action">
      <span className="alerte-icone" aria-hidden="true"><AlertTriangle size={16} /></span>
      <div className="alerte-texte">
        <p className="alerte-titre">{titre}</p>
        <p className="alerte-detail">{detail}</p>
      </div>
      <ButtonLink to={lien} variante="primaire" taille="sm">{libelleLien}</ButtonLink>
    </div>
  )
}

/* ── Écran ───────────────────────────────────────────────────── */

export default function Dashboard() {
  const { user } = useAuth()
  const estProprietaire = user?.role === 'proprietaire'

  // `useRequete` plutôt que `.then().catch(() => {})` : le code précédent
  // avalait ses erreurs, et un espace vide sur panne réseau se lisait comme
  // un compte sans aucune réservation.
  const { donnees: reservations } = useRequete<Reservation[]>(
    async (signal) => (await api.get('/reservations', { signal })).data,
    'reservations',
    { messageErreurParDefaut: 'Impossible de charger vos réservations.' }
  )

  const { donnees: villas } = useRequete<Villa[]>(
    async (signal) => (estProprietaire ? (await api.get('/proprietaire/villas', { signal })).data : []),
    `villas-${estProprietaire}`,
    { messageErreurParDefaut: 'Impossible de charger vos villas.' }
  )

  const { donnees: favoris } = useRequete<unknown[]>(
    async (signal) => (estProprietaire ? [] : (await api.get('/favoris', { signal })).data),
    `favoris-${estProprietaire}`,
    { messageErreurParDefaut: 'Impossible de charger vos favoris.' }
  )

  const liste = reservations ?? []
  const enAttente = liste.filter((r) => r.statut === 'en_attente')
  const confirmees = liste.filter((r) => r.statut === 'confirmee')

  // Une réservation vivante dont le paiement n'a pas abouti : le client doit
  // pouvoir y revenir. Quitter la fiche de la villa fermait autrefois toute
  // porte vers le règlement.
  const aRegler = liste.filter(
    (r) => r.statut !== 'annulee' && r.paiement?.statut !== 'reussi' && r.paiement !== undefined && r.paiement !== null
  )

  const aujourdhui = new Date().toISOString().slice(0, 10)

  // Un séjour déjà commencé n'est pas « prochain ». Le ranger sous ce titre
  // affichait une date passée, ce qui se lit comme une erreur d'affichage
  // plutôt que comme un séjour en cours.
  const prochain = confirmees
    .filter((r) => r.date_fin >= aujourdhui)
    .sort((a, b) => a.date_debut.localeCompare(b.date_debut))[0]

  const sejourEnCours = Boolean(prochain && prochain.date_debut <= aujourdhui)

  const encaisse = confirmees.reduce((s, r) => s + Number(r.montant_total || 0), 0)
  const villasPubliees = (villas ?? []).filter((v) => v.statut === 'validee').length
  const villasAttente = (villas ?? []).filter((v) => v.statut === 'en_attente').length

  return (
    <div>
      <h1 className="console-titre">Bonjour, {user?.name?.split(' ')[0]}</h1>
      <p className="console-sous-titre">
        {estProprietaire
          ? 'Vos annonces, vos demandes et ce qu’elles ont rapporté.'
          : 'Vos séjours, vos favoris et ce qu’il reste à régler.'}
      </p>

      {/* ── Ce qui attend une action ── */}
      {estProprietaire && enAttente.length > 0 && (
        <Alerte
          titre={`${enAttente.length} demande${enAttente.length > 1 ? 's' : ''} de réservation en attente`}
          detail="Un client attend votre réponse. Passé un certain délai, il réserve ailleurs."
          lien="/dashboard/reservations"
          libelleLien="Répondre"
        />
      )}

      {!estProprietaire && aRegler.length > 0 && (
        <Alerte
          titre={`${aRegler.length} réservation${aRegler.length > 1 ? 's' : ''} à régler`}
          detail="Votre place n’est retenue qu’une fois le paiement abouti."
          lien="/dashboard/reservations"
          libelleLien="Régler"
        />
      )}

      {/* ── Chiffres ── */}
      <div className="chiffres">
        {estProprietaire ? (
          <>
            <Chiffre
              Icone={Clock}
              libelle="Demandes en attente"
              valeur={enAttente.length}
              detail="à confirmer ou refuser"
              action={enAttente.length > 0}
            />
            <Chiffre
              Icone={Building2}
              libelle="Villas publiées"
              valeur={villasPubliees}
              detail={villasAttente > 0 ? `${villasAttente} en cours de validation` : 'toutes validées'}
            />
            <Chiffre
              Icone={CalendarDays}
              libelle="Réservations"
              valeur={liste.length}
              detail={`${confirmees.length} confirmée${confirmees.length > 1 ? 's' : ''}`}
            />
            <Chiffre
              Icone={Wallet}
              libelle="Volume confirmé"
              valeur={fcfaCourt(encaisse)}
              detail="réservations acceptées"
            />
          </>
        ) : (
          <>
            <Chiffre
              Icone={CalendarDays}
              libelle="Mes réservations"
              valeur={liste.length}
              detail={`${confirmees.length} confirmée${confirmees.length > 1 ? 's' : ''}`}
            />
            <Chiffre
              Icone={CreditCard}
              libelle="À régler"
              valeur={aRegler.length}
              detail={aRegler.length > 0 ? 'paiement non abouti' : 'rien en attente'}
              action={aRegler.length > 0}
            />
            <Chiffre
              Icone={Heart}
              libelle="Favoris"
              valeur={(favoris ?? []).length}
              detail="villas enregistrées"
            />
            <Chiffre
              Icone={Home}
              libelle={sejourEnCours ? 'Séjour en cours' : 'Prochain séjour'}
              /* En cours, la date utile est celle du départ ; à venir, celle
                 de l'arrivée. C'est la question qu'on se pose dans chaque cas. */
              valeur={prochain ? dateCourte(sejourEnCours ? prochain.date_fin : prochain.date_debut) : '—'}
              detail={prochain?.logement?.villa?.nom ?? 'aucun séjour prévu'}
            />
          </>
        )}
      </div>

      {/* ── Prochain séjour, en détail ── */}
      {prochain && (
        <section className="panneau" style={{ marginBottom: 'var(--space-4)' }}>
          <h2 className="panneau-titre">
            <CalendarDays size={16} /> {sejourEnCours ? 'Séjour en cours' : 'Prochain séjour'}
          </h2>
          <div className="prochain">
            <div>
              <p className="prochain-nom">{prochain.logement?.villa?.nom ?? 'Villa'}</p>
              <p className="prochain-detail">{prochain.logement?.nom}</p>
            </div>
            <div className="prochain-dates">
              <span>{dateCourte(prochain.date_debut)}</span>
              <ArrowRight size={14} aria-hidden="true" />
              <span>{dateCourte(prochain.date_fin)}</span>
            </div>
          </div>
        </section>
      )}

      {/* ── Raccourcis ── */}
      <div className="console-grille console-grille-2">
        {estProprietaire ? (
          <>
            <Raccourci to="/dashboard/villas" Icone={Building2} titre="Mes villas" detail="Logements, tarifs, photos, disponibilités" />
            <Raccourci to="/dashboard/villas/nouvelle" Icone={Plus} titre="Publier une annonce" detail="Villa, résidence, appartement ou chambre" />
          </>
        ) : (
          <>
            <Raccourci to="/hebergements" Icone={Compass} titre="Explorer" detail="Villas, appartements, piscines à la journée" />
            <Raccourci to="/dashboard/favoris" Icone={Heart} titre="Mes favoris" detail="Les logements que vous avez enregistrés" />
          </>
        )}
      </div>
    </div>
  )
}
