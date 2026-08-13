import { NavLink, useLocation } from 'react-router-dom'
import { Home, Search, CalendarDays, User } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

/**
 * Navigation basse — planche 09, « châssis d'application ».
 *
 * C'est le levier qui fait le plus pour qu'une interface web soit perçue
 * comme une application : la destination est atteinte au pouce, sans
 * remonter chercher un menu en haut d'écran. Elle ne s'affiche qu'en mobile,
 * où le pouce est le seul dispositif de pointage.
 *
 * Les onglets d'un espace privé mènent à la connexion tant qu'on n'y est pas :
 * masquer l'onglet ferait disparaître la carte du produit pour un visiteur.
 */
export default function NavigationBasse() {
  const { user } = useAuth()
  const { pathname } = useLocation()

  // Le tunnel de paiement et les feuilles occupent l'écran : y superposer une
  // barre de navigation invite à abandonner au moment de payer.
  const masquee = pathname.startsWith('/reservation/') || pathname.startsWith('/paiement')
  if (masquee) return null

  const espace = user ? '/dashboard' : '/login'

  const onglets = [
    { to: '/', libelle: 'Explorer', Icone: Home, exact: true },
    { to: '/villas', libelle: 'Recherche', Icone: Search },
    { to: user ? '/dashboard/reservations' : espace, libelle: 'Réservations', Icone: CalendarDays },
    { to: user ? '/dashboard/profil' : espace, libelle: 'Compte', Icone: User },
  ]

  return (
    <nav className="nav-basse" aria-label="Navigation principale">
      {onglets.map(({ to, libelle, Icone, exact }) => (
        <NavLink
          key={libelle}
          to={to}
          end={exact}
          className={({ isActive }) => `nav-basse-onglet${isActive ? ' est-actif' : ''}`}
        >
          <Icone size={22} strokeWidth={1.9} aria-hidden="true" />
          <span>{libelle}</span>
        </NavLink>
      ))}
    </nav>
  )
}
