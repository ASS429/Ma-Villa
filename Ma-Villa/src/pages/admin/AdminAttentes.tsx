import {
  AlertTriangle, Building2, Banknote, ShoppingBag, MessageSquare,
  CreditCard, BellRing, CheckCircle2, ArrowRight, Wallet,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { useRequete } from '../../lib/useRequete'
import { fcfa, fcfaCourt } from '../../lib/format'
import Button from '../../components/ui/Button'

/* ── Ce que renvoie l'API ────────────────────────────────────── */

type Gravite = 'urgent' | 'action' | 'calme'

interface Ligne {
  cle: string
  gravite: Gravite
  compte: number | null
  montant?: number
  titre: string
  detail: string
  lien: string
  libelle_lien: string
}

interface Fonds {
  exigible: number
  a_venir: number
  detenus: number
  non_versable: number
  automatique: boolean
}

interface Attentes {
  lignes: Ligne[]
  total: number
  fonds: Fonds
}

/**
 * L'icône dit de quoi il s'agit avant qu'on ait lu la phrase. Une file
 * parcourue chaque matin se reconnaît à ses formes, pas à son texte.
 */
const ICONES: Record<string, typeof Building2> = {
  villas:              Building2,
  versements:          Banknote,
  versements_panne:    AlertTriangle,
  commandes_impayees:  ShoppingBag,
  commandes_expedier:  ShoppingBag,
  avis:                MessageSquare,
  sonde_paiement:      CreditCard,
  sonde_notifications: BellRing,
}

/* ── Une ligne de la file ────────────────────────────────────── */

function Attente({ ligne }: { ligne: Ligne }) {
  const Icone = ICONES[ligne.cle] ?? AlertTriangle

  return (
    <article className={`attente est-${ligne.gravite}`}>
      <span className="attente-icone" aria-hidden="true"><Icone size={17} /></span>

      <div className="attente-texte">
        <p className="attente-titre">{ligne.titre}</p>
        <p className="attente-detail">{ligne.detail}</p>
        {/* Le montant vient après la phrase, pas dedans : il se lit d'un coup
            d'œil et se compare d'une ligne à l'autre. */}
        {ligne.montant != null && (
          <p className="attente-montant">{fcfa(ligne.montant)}</p>
        )}
      </div>

      <Link to={ligne.lien} className="attente-action">
        {ligne.libelle_lien}
        <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </article>
  )
}

/* ── L'écran ─────────────────────────────────────────────────── */

/**
 * La première entrée de la console : **ai-je du travail ?**
 *
 * Avant cet écran, la réponse coûtait l'ouverture de neuf pages, et l'absence
 * de travail coûtait autant que sa présence. Trois partis pris :
 *
 *   — **rien à faire affiche « rien à faire »**, pas une liste de zéros ;
 *   — **chaque ligne dit ce qu'elle coûte si on l'ignore.** Un compteur seul
 *     ne permet pas de choisir entre deux files ;
 *   — **l'argent détenu pour autrui est en tête**, parce que c'est le seul
 *     chiffre dont la plateforme n'est pas propriétaire.
 */
export default function AdminAttentes() {
  const { donnees, chargement, erreur, reessayer } = useRequete<Attentes>(
    (signal) => api.get('/admin/attentes', { signal }).then((r) => r.data),
    'attentes',
    { messageErreurParDefaut: 'Impossible de lire la file de travail.' }
  )

  const lignes = donnees?.lignes ?? []
  const fonds = donnees?.fonds

  return (
    <div>
      <h1 className="console-titre">Ce qui attend</h1>
      <p className="console-sous-titre">
        {chargement
          ? 'Relevé en cours…'
          : lignes.length === 0
            ? 'Tout est traité.'
            : `${lignes.length} point${lignes.length > 1 ? 's' : ''} demande${lignes.length > 1 ? 'nt' : ''} une décision.`}
      </p>

      {erreur && !chargement && (
        <div className="console-erreur" role="alert">
          {erreur}
          <Button variante="secondaire" taille="sm" onClick={reessayer}>Réessayer</Button>
        </div>
      )}

      {/* ── L'argent détenu pour autrui ───────────────────────────
          Il est en tête parce qu'il n'appartient pas à la plateforme.
          `non_versable` est le chiffre qui dit qu'une situation est
          intenable : encaissé, exigible, et qu'aucun automatisme ne peut
          rendre tant que le déboursement n'est pas ouvert. */}
      {fonds && fonds.detenus > 0 && (
        <section className={`fonds${fonds.non_versable > 0 ? ' est-bloque' : ''}`}>
          <div className="fonds-principal">
            <span className="fonds-icone" aria-hidden="true"><Wallet size={16} /></span>
            <div>
              <p className="fonds-libelle">Détenu pour les propriétaires</p>
              <p className="fonds-valeur">{fcfa(fonds.detenus)}</p>
            </div>
          </div>

          <dl className="fonds-detail">
            <div>
              <dt>Exigible</dt>
              <dd>{fcfaCourt(fonds.exigible)}</dd>
            </div>
            <div>
              <dt>Séjours en cours</dt>
              <dd>{fcfaCourt(fonds.a_venir)}</dd>
            </div>
          </dl>

          {fonds.non_versable > 0 && (
            <p className="fonds-alerte">
              <AlertTriangle size={14} aria-hidden="true" />
              <span>
                <strong>{fcfa(fonds.non_versable)} encaissés et non versables.</strong>{' '}
                Le déboursement automatique n'est pas ouvert : chaque versement
                se fait à la main, ou ne se fait pas.
              </span>
            </p>
          )}
        </section>
      )}

      {chargement ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {[1, 2, 3].map((n) => (
            <div key={n} className="panneau">
              <div className="skeleton" style={{ height: 14, width: '45%', borderRadius: 6, marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 12, width: '75%', borderRadius: 6 }} />
            </div>
          ))}
        </div>
      ) : lignes.length === 0 && !erreur ? (
        // Le vide est un résultat, pas un manque : il mérite d'être affirmé.
        <div className="console-vide">
          <span className="console-vide-icone"><CheckCircle2 size={22} /></span>
          <p>
            <strong>Rien n'attend de décision.</strong> Aucune annonce à valider,
            aucun versement dû, aucune commande en souffrance.
          </p>
        </div>
      ) : (
        <div className="attentes">
          {lignes.map((ligne) => <Attente key={ligne.cle} ligne={ligne} />)}
        </div>
      )}
    </div>
  )
}
