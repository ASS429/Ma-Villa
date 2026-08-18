import { Link } from 'react-router-dom'
import {
  Users, Building2, Clock, CalendarDays, Wallet, Star, TrendingUp, TrendingDown,
  Activity, MapPin, UserPlus, CheckCircle2, AlertTriangle,
} from 'lucide-react'
import api from '../../services/api'
import { useRequete } from '../../lib/useRequete'
import { fcfa, fcfaCourt, depuis, noteLisible } from '../../lib/format'
import { Courbe, Barres } from '../../components/console/Graphe'
import { ButtonLink } from '../../components/ui/Button'

/* ── Formes renvoyées par l'API ──────────────────────────────── */

interface Stats {
  utilisateurs: { total: number; nouveaux: number; variation: number | null; proprietaires: number; clients: number }
  villas: { total: number; en_attente: number; validees: number; rejetees: number; vedettes: number }
  reservations: { total: number; en_attente: number; confirmees: number; annulees: number; periode: number; variation: number | null }
  finances: {
    volume_confirme: number; encaisse: number; encaisse_periode: number
    commission: number; paiements_en_attente: number; paiements_echoues: number
  }
  avis: { total: number; periode: number; note_moyenne: number }
  fenetre_jours: number
}

interface Serie {
  jours: { date: string; libelle: string; reservations: number; comptes: number; encaisse: number }[]
  villes: { ville: string; total: number }[]
}

interface Evenement {
  type: 'villa' | 'compte' | 'reservation'
  id: number
  titre: string
  detail: string
  statut: string
  date: string
}

/* ── Carte de chiffre ────────────────────────────────────────── */

interface ProprietesChiffre {
  Icone: typeof Users
  libelle: string
  valeur: string | number
  detail?: string
  variation?: number | null
  /** Colore la carte quand — et seulement quand — il y a quelque chose à faire. */
  action?: boolean
}

function Chiffre({ Icone, libelle, valeur, detail, variation, action }: ProprietesChiffre) {
  return (
    <article className={`chiffre${action ? ' demande-action' : ''}`}>
      <div className="chiffre-haut">
        <span className="chiffre-icone" aria-hidden="true"><Icone size={16} /></span>

        {/* `null` signifie « pas de période précédente » : afficher « +100 % »
            sur un premier inscrit serait un chiffre inventé. */}
        {variation != null && (
          <span className={`chiffre-variation ${variation >= 0 ? 'est-hausse' : 'est-baisse'}`}>
            {variation >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(variation)} %
          </span>
        )}
      </div>

      <p className="chiffre-valeur">{valeur}</p>
      <p className="chiffre-libelle">{libelle}</p>
      {detail && <p className="chiffre-detail">{detail}</p>}
    </article>
  )
}

function Squelette({ n }: { n: number }) {
  return (
    <div className="chiffres">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="chiffre">
          <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 12 }} />
          <div className="skeleton" style={{ height: 30, width: '60%', borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 10, width: '80%', borderRadius: 6 }} />
        </div>
      ))}
    </div>
  )
}

/* ── Fil d'activité ──────────────────────────────────────────── */

const ICONE_EVENEMENT = {
  villa: Building2,
  compte: UserPlus,
  reservation: CalendarDays,
} as const

function FilActivite({ evenements }: { evenements: Evenement[] }) {
  if (evenements.length === 0) {
    return (
      <div className="console-vide">
        <span className="console-vide-icone"><Activity size={22} /></span>
        <p>Rien ne s'est encore passé sur la plateforme.</p>
      </div>
    )
  }

  return (
    <ul className="activite">
      {evenements.map((e) => {
        const Icone = ICONE_EVENEMENT[e.type]

        return (
          <li key={`${e.type}-${e.id}`} className="activite-ligne">
            <span className={`activite-icone est-${e.type}`} aria-hidden="true"><Icone size={15} /></span>
            <div className="activite-texte">
              <p className="activite-titre">{e.titre}</p>
              <p className="activite-detail">{e.detail}</p>
            </div>
            <time className="activite-quand" dateTime={e.date}>{depuis(e.date)}</time>
          </li>
        )
      })}
    </ul>
  )
}

/* ── Écran ───────────────────────────────────────────────────── */

export default function AdminDashboard() {
  const { donnees: stats, chargement } = useRequete<Stats>(
    async (signal) => (await api.get('/admin/stats', { signal })).data,
    'stats',
    { messageErreurParDefaut: 'Impossible de charger les statistiques.' }
  )

  const { donnees: serie } = useRequete<Serie>(
    async (signal) => (await api.get('/admin/statistiques', { signal })).data,
    'series',
    { messageErreurParDefaut: 'Impossible de charger les séries.' }
  )

  const { donnees: activite } = useRequete<Evenement[]>(
    async (signal) => (await api.get('/admin/activite', { signal })).data,
    'activite',
    { messageErreurParDefaut: "Impossible de charger l'activité." }
  )

  const jours = serie?.jours ?? []

  return (
    <div>
      <h1 className="console-titre">Tableau de bord</h1>
      <p className="console-sous-titre">
        Vue d'ensemble de la plateforme{stats ? ` — ${stats.fenetre_jours} derniers jours` : ''}
      </p>

      {/* Ce qui réclame une action passe avant les chiffres de fond : c'est
          le métier quotidien de l'administrateur, pas la culture générale. */}
      {stats && stats.villas.en_attente > 0 && (
        <div className="panneau" style={{ marginBottom: 'var(--space-5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <span className="chiffre-icone" style={{ background: 'color-mix(in srgb, var(--warning) 16%, transparent)', color: 'var(--warning)' }}>
              <AlertTriangle size={16} />
            </span>
            <div style={{ flex: 1, minWidth: 180 }}>
              <p style={{ margin: 0, font: 'var(--t-body-sm)', fontWeight: 600, color: 'var(--text-1)' }}>
                {stats.villas.en_attente} annonce{stats.villas.en_attente > 1 ? 's' : ''} en attente de validation
              </p>
              <p style={{ margin: 0, font: 'var(--t-caption)', color: 'var(--text-2)' }}>
                Tant qu'elles ne sont pas traitées, elles restent invisibles au public.
              </p>
            </div>
            <ButtonLink variante="primaire" taille="sm" to="/admin/villas">Les examiner</ButtonLink>
          </div>
        </div>
      )}

      {chargement || !stats ? (
        <Squelette n={8} />
      ) : (
        <div className="chiffres">
          <Chiffre
            Icone={Clock}
            libelle="En attente"
            valeur={stats.villas.en_attente}
            detail="annonces à valider"
            action={stats.villas.en_attente > 0}
          />
          <Chiffre
            Icone={Building2}
            libelle="Villas publiées"
            valeur={stats.villas.validees}
            detail={`${stats.villas.total} au total · ${stats.villas.vedettes} en vedette`}
          />
          <Chiffre
            Icone={Users}
            libelle="Comptes"
            valeur={stats.utilisateurs.total}
            detail={`${stats.utilisateurs.proprietaires} propriétaires · ${stats.utilisateurs.clients} clients`}
            variation={stats.utilisateurs.variation}
          />
          <Chiffre
            Icone={CalendarDays}
            libelle="Réservations"
            valeur={stats.reservations.total}
            detail={`${stats.reservations.confirmees} confirmées · ${stats.reservations.en_attente} en attente`}
            variation={stats.reservations.variation}
          />

          {/* Encaissé et volume réservé sont deux notions distinctes, et les
              confondre donne un chiffre d'affaires imaginaire. */}
          <Chiffre
            Icone={Wallet}
            libelle="Encaissé"
            valeur={fcfaCourt(stats.finances.encaisse)}
            detail={`dont ${fcfaCourt(stats.finances.commission)} de commission`}
          />
          <Chiffre
            Icone={CheckCircle2}
            libelle="Volume réservé"
            valeur={fcfaCourt(stats.finances.volume_confirme)}
            detail="réservations confirmées"
          />
          <Chiffre
            Icone={AlertTriangle}
            libelle="Paiements bloqués"
            valeur={stats.finances.paiements_en_attente + stats.finances.paiements_echoues}
            detail={`${stats.finances.paiements_en_attente} en cours · ${stats.finances.paiements_echoues} échoués`}
            action={stats.finances.paiements_echoues > 0}
          />
          <Chiffre
            Icone={Star}
            libelle="Avis"
            valeur={stats.avis.total}
            detail={stats.avis.note_moyenne ? `note moyenne ${noteLisible(stats.avis.note_moyenne)} / 5` : 'aucune note'}
          />
        </div>
      )}

      <div className="console-grille console-grille-large" style={{ marginBottom: 'var(--space-4)' }}>
        <section className="panneau">
          <h2 className="panneau-titre"><Activity size={16} /> Réservations par jour</h2>
          <Courbe
            points={jours.map((j) => ({ libelle: j.libelle, valeur: j.reservations }))}
            titreAccessible="Réservations par jour sur trente jours"
          />
        </section>

        <section className="panneau">
          <h2 className="panneau-titre"><MapPin size={16} /> Offre par ville</h2>
          <Barres
            lignes={(serie?.villes ?? []).map((v) => ({ nom: v.ville, valeur: v.total }))}
            format={(n) => `${n} villa${n > 1 ? 's' : ''}`}
          />
        </section>
      </div>

      <div className="console-grille console-grille-2">
        <section className="panneau">
          <h2 className="panneau-titre"><Wallet size={16} /> Encaissements par jour</h2>
          <Courbe
            points={jours.map((j) => ({ libelle: j.libelle, valeur: j.encaisse }))}
            format={fcfa}
            titreAccessible="Encaissements par jour sur trente jours"
          />
        </section>

        <section className="panneau">
          <div className="console-section">
            <h2 style={{ margin: 0, font: 'var(--t-h3)' }}>Activité récente</h2>
            <Link to="/admin/villas">Voir les annonces</Link>
          </div>
          <FilActivite evenements={activite ?? []} />
        </section>
      </div>
    </div>
  )
}
