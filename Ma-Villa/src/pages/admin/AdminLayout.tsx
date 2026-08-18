import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutGrid, Building2, Users, MessageSquare, CreditCard,
  Menu, X, Sun, Moon, LogOut, ArrowLeft,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import api from '../../services/api'
import Button from '../../components/ui/Button'

interface Entree {
  to: string
  label: string
  Icone: typeof LayoutGrid
  end?: boolean
  /** Clé du compteur d'attente, s'il y en a un. */
  attente?: 'villas' | 'avis'
}

const ENTREES: Entree[] = [
  { to: '/admin',              label: 'Tableau de bord', Icone: LayoutGrid,     end: true },
  { to: '/admin/villas',       label: 'Villas',          Icone: Building2,      attente: 'villas' },
  { to: '/admin/utilisateurs', label: 'Utilisateurs',    Icone: Users },
  { to: '/admin/avis',         label: 'Avis',            Icone: MessageSquare },
  { to: '/admin/paiement',     label: 'Encaissement',    Icone: CreditCard },
]

function initiales(nom: string) {
  return nom.split(' ').map((m) => m[0]).join('').toUpperCase().slice(0, 2)
}

/**
 * Compteurs affichés sur la navigation.
 *
 * Ils disent ce qui réclame une action **avant** d'ouvrir l'écran. Sans eux,
 * on ouvre « Villas » pour découvrir qu'il n'y a rien à faire — ou, plus
 * coûteux, on ne l'ouvre pas alors que douze annonces attendent depuis trois
 * jours et que leurs propriétaires, eux, attendent aussi.
 */
function useAttentes() {
  const [attentes, setAttentes] = useState<{ villas: number }>({ villas: 0 })
  const emplacement = useLocation()

  const relire = useCallback(() => {
    api.get('/admin/stats')
      .then((r) => setAttentes({ villas: r.data?.villas?.en_attente ?? 0 }))
      .catch(() => { /* le compteur disparaît, la navigation reste utilisable */ })
  }, [])

  // Relu à chaque changement d'écran : après avoir validé trois villas, le
  // compteur doit descendre. Le laisser figé donnerait un travail qui ne
  // finit jamais.
  useEffect(relire, [relire, emplacement.pathname])

  return attentes
}

function Navigation({ attentes, onNaviguer }: { attentes: { villas: number }; onNaviguer?: () => void }) {
  return (
    <nav className="console-nav" aria-label="Administration">
      {ENTREES.map(({ to, label, Icone, end, attente }) => {
        const compte = attente === 'villas' ? attentes.villas : 0

        return (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNaviguer}
            className={({ isActive }) => `console-lien${isActive ? ' est-actif' : ''}`}
          >
            <Icone size={17} aria-hidden="true" />
            <span className="console-lien-libelle">{label}</span>
            {compte > 0 && (
              <span className="console-compteur" aria-label={`${compte} en attente`}>
                {compte > 99 ? '99+' : compte}
              </span>
            )}
          </NavLink>
        )
      })}

      <div className="console-separateur" />

      <Link to="/" className="console-lien" onClick={onNaviguer}>
        <ArrowLeft size={17} aria-hidden="true" />
        <span className="console-lien-libelle">Retour au site</span>
      </Link>
    </nav>
  )
}

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const emplacement = useLocation()
  const [tiroir, setTiroir] = useState(false)
  const attentes = useAttentes()

  // Le tiroir se referme au changement d'écran : le laisser ouvert masquerait
  // la page qu'on vient de demander.
  //
  // Ajusté pendant le rendu plutôt que dans un effet — le motif que React
  // recommande pour aligner un état sur une valeur qui change. Dans un effet,
  // le tiroir resterait visible le temps d'un rendu de plus, et l'écran
  // apparaîtrait derrière lui avant de se découvrir. Les clics sur un lien
  // sont déjà couverts par `onNaviguer` ; ceci rattrape le retour arrière du
  // navigateur, tiroir ouvert.
  const [cheminAffiche, setCheminAffiche] = useState(emplacement.pathname)
  if (cheminAffiche !== emplacement.pathname) {
    setCheminAffiche(emplacement.pathname)
    setTiroir(false)
  }

  // Échap ferme le tiroir, comme toute surface modale.
  useEffect(() => {
    if (!tiroir) return
    const surTouche = (e: KeyboardEvent) => { if (e.key === 'Escape') setTiroir(false) }
    document.addEventListener('keydown', surTouche)
    return () => document.removeEventListener('keydown', surTouche)
  }, [tiroir])

  const deconnecter = () => { logout(); navigate('/login') }

  const titreEcran = ENTREES.find(
    (e) => (e.end ? emplacement.pathname === e.to : emplacement.pathname.startsWith(e.to))
  )?.label ?? 'Administration'

  const identite = (
    <div className="console-identite">
      <div className="console-jeton" aria-hidden="true">{initiales(user?.name || '')}</div>
      <div className="console-identite-texte">
        <p className="console-identite-nom">{user?.name}</p>
        <p className="console-identite-role">Administrateur</p>
      </div>
    </div>
  )

  return (
    <div className="console">
      {/* ── Barre latérale, à partir du grand écran ── */}
      <aside className="console-flanc">
        <Link to="/" className="console-marque">
          <span className="console-marque-nom">Ma Villa</span>
          <span className="console-marque-role">Admin</span>
        </Link>

        <Navigation attentes={attentes} />

        <div className="console-pied">
          {identite}
          <div className="console-actions">
            <Button
              variante="discret"
              taille="sm"
              onClick={toggleTheme}
              iconeAvant={isDark ? <Sun size={15} /> : <Moon size={15} />}
              aria-label={isDark ? 'Passer au thème clair' : 'Passer au thème sombre'}
            />
            <Button
              variante="discret"
              taille="sm"
              onClick={deconnecter}
              iconeAvant={<LogOut size={15} />}
            >
              Déconnexion
            </Button>
          </div>
        </div>
      </aside>

      <div className="console-corps">
        {/* ── En-tête mobile ── */}
        <header className="console-entete">
          <Button
            variante="discret"
            taille="sm"
            onClick={() => setTiroir(true)}
            iconeAvant={<Menu size={19} />}
            aria-label="Ouvrir le menu"
            aria-expanded={tiroir}
          />
          {/* Le titre de l'écran plutôt que le nom du produit : sur un outil
              de travail, savoir où l'on est vaut mieux que se voir rappeler
              la marque à chaque écran. */}
          <span className="console-entete-titre">{titreEcran}</span>
          <Button
            variante="discret"
            taille="sm"
            onClick={toggleTheme}
            iconeAvant={isDark ? <Sun size={17} /> : <Moon size={17} />}
            aria-label={isDark ? 'Passer au thème clair' : 'Passer au thème sombre'}
          />
        </header>

        {/* ── Tiroir mobile ── */}
        {tiroir && (
          <>
            <div className="console-voile" onClick={() => setTiroir(false)} aria-hidden="true" />
            <div className="console-tiroir" role="dialog" aria-label="Navigation" aria-modal="true">
              <div className="console-marque">
                <span className="console-marque-nom">Ma Villa</span>
                <span className="console-marque-role">Admin</span>
                <Button
                  variante="discret"
                  taille="sm"
                  onClick={() => setTiroir(false)}
                  iconeAvant={<X size={18} />}
                  aria-label="Fermer le menu"
                />
              </div>

              <Navigation attentes={attentes} onNaviguer={() => setTiroir(false)} />

              <div className="console-pied">
                {identite}
                <Button variante="secondaire" taille="sm" bloc onClick={deconnecter} iconeAvant={<LogOut size={15} />}>
                  Déconnexion
                </Button>
              </div>
            </div>
          </>
        )}

        <main className="console-principal">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
