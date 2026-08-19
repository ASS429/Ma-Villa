import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Home, Building2, CalendarDays, Heart, User,
  Menu, X, Sun, Moon, LogOut, ArrowLeft, Plus,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { MessagesProvider, useMessages } from '../../context/MessagesContext'
import Button, { ButtonLink } from '../../components/ui/Button'

interface Entree {
  to: string
  label: string
  Icone: typeof Home
  end?: boolean
}

const PROPRIETAIRE: Entree[] = [
  { to: '/dashboard',              label: 'Accueil',      Icone: Home, end: true },
  { to: '/dashboard/villas',       label: 'Mes villas',   Icone: Building2 },
  { to: '/dashboard/reservations', label: 'Réservations', Icone: CalendarDays },
  { to: '/dashboard/profil',       label: 'Profil',       Icone: User },
]

const CLIENT: Entree[] = [
  { to: '/dashboard',              label: 'Accueil',          Icone: Home, end: true },
  { to: '/dashboard/reservations', label: 'Mes réservations', Icone: CalendarDays },
  { to: '/dashboard/favoris',      label: 'Favoris',          Icone: Heart },
  { to: '/dashboard/profil',       label: 'Profil',           Icone: User },
]

function initiales(nom: string) {
  return nom.split(' ').map((m) => m[0]).join('').toUpperCase().slice(0, 2)
}

function Navigation({ entrees, onNaviguer }: { entrees: Entree[]; onNaviguer?: () => void }) {
  const { total } = useMessages()

  return (
    <nav className="console-nav" aria-label="Mon espace">
      {entrees.map(({ to, label, Icone, end }) => {
        // Les messages vivent dans les reservations : la pastille se pose donc
        // sur cette entree, la ou l'on ira les lire.
        const nonLus = to === '/dashboard/reservations' ? total : 0

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
            {nonLus > 0 && (
              <span className="console-pastille" aria-label={`${nonLus} message${nonLus > 1 ? 's' : ''} non lu${nonLus > 1 ? 's' : ''}`}>
                {nonLus > 9 ? '9+' : nonLus}
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

/**
 * Espace personnel du propriétaire et du client.
 *
 * Même châssis que la console d'administration — la barre latérale, le tiroir
 * mobile et les surfaces viennent de `styles/console.css`. Ces deux espaces
 * avaient chacun leur copie du même agencement, stylée en ligne : corriger
 * l'un laissait l'autre en arrière.
 */
function Espace() {
  const { user, logout } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const emplacement = useLocation()
  const [tiroir, setTiroir] = useState(false)

  const estProprietaire = user?.role === 'proprietaire'
  const entrees = estProprietaire ? PROPRIETAIRE : CLIENT

  // Ajusté pendant le rendu plutôt que dans un effet : dans un effet, le
  // tiroir resterait affiché le temps d'un rendu de plus par-dessus l'écran
  // qu'on vient de demander.
  const [cheminAffiche, setCheminAffiche] = useState(emplacement.pathname)
  if (cheminAffiche !== emplacement.pathname) {
    setCheminAffiche(emplacement.pathname)
    setTiroir(false)
  }

  useEffect(() => {
    if (!tiroir) return
    const surTouche = (e: KeyboardEvent) => { if (e.key === 'Escape') setTiroir(false) }
    document.addEventListener('keydown', surTouche)
    return () => document.removeEventListener('keydown', surTouche)
  }, [tiroir])

  const deconnecter = () => { logout(); navigate('/login') }

  const titreEcran = entrees.find(
    (e) => (e.end ? emplacement.pathname === e.to : emplacement.pathname.startsWith(e.to))
  )?.label ?? 'Mon espace'

  const identite = (
    <div className="console-identite">
      <div className="console-jeton" aria-hidden="true">{initiales(user?.name || '')}</div>
      <div className="console-identite-texte">
        <p className="console-identite-nom">{user?.name}</p>
        <p className="console-identite-role">{estProprietaire ? 'Propriétaire' : 'Client'}</p>
      </div>
    </div>
  )

  return (
    <div className="console">
      <aside className="console-flanc">
        <Link to="/" className="console-marque">
          <span className="console-marque-nom">Ma Villa</span>
        </Link>

        {/* L'action de création est dans la barre, pas noyée dans un écran :
            publier une annonce est ce qu'un propriétaire vient faire. */}
        {estProprietaire && (
          <div style={{ padding: 'var(--space-3) var(--space-3) 0' }}>
            <ButtonLink to="/dashboard/villas/nouvelle" variante="primaire" taille="sm" bloc iconeAvant={<Plus size={15} />}>
              Publier une villa
            </ButtonLink>
          </div>
        )}

        <Navigation entrees={entrees} />

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
            <Button variante="discret" taille="sm" onClick={deconnecter} iconeAvant={<LogOut size={15} />}>
              Déconnexion
            </Button>
          </div>
        </div>
      </aside>

      <div className="console-corps">
        <header className="console-entete">
          <Button
            variante="discret"
            taille="sm"
            onClick={() => setTiroir(true)}
            iconeAvant={<Menu size={19} />}
            aria-label="Ouvrir le menu"
            aria-expanded={tiroir}
          />
          <span className="console-entete-titre">{titreEcran}</span>
          <Button
            variante="discret"
            taille="sm"
            onClick={toggleTheme}
            iconeAvant={isDark ? <Sun size={17} /> : <Moon size={17} />}
            aria-label={isDark ? 'Passer au thème clair' : 'Passer au thème sombre'}
          />
        </header>

        {tiroir && (
          <>
            <div className="console-voile" onClick={() => setTiroir(false)} aria-hidden="true" />
            <div className="console-tiroir" role="dialog" aria-label="Navigation" aria-modal="true">
              <div className="console-marque">
                <span className="console-marque-nom">Ma Villa</span>
                <Button
                  variante="discret"
                  taille="sm"
                  onClick={() => setTiroir(false)}
                  iconeAvant={<X size={18} />}
                  aria-label="Fermer le menu"
                />
              </div>

              {estProprietaire && (
                <div style={{ padding: 'var(--space-3) var(--space-3) 0' }}>
                  <ButtonLink
                    to="/dashboard/villas/nouvelle"
                    variante="primaire"
                    taille="sm"
                    bloc
                    iconeAvant={<Plus size={15} />}
                    onClick={() => setTiroir(false)}
                  >
                    Publier une villa
                  </ButtonLink>
                </div>
              )}

              <Navigation entrees={entrees} onNaviguer={() => setTiroir(false)} />

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

/**
 * Le compteur de messages est monté ici, au-dessus de l'écran : la pastille de
 * navigation et celles des cartes de réservation lisent le même chiffre, donc
 * une seule requête sert les deux.
 */
export default function DashboardLayout() {
  return (
    <MessagesProvider>
      <Espace />
    </MessagesProvider>
  )
}
