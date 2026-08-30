import { NavLink, useLocation } from 'react-router-dom'
import { Home, Search, CalendarDays, User, Palette } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useConfig } from '../../context/ConfigContext'
import { useMessages } from '../../context/MessagesContext'

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
  const { boutique } = useConfig()
  const { total: nonLus } = useMessages()
  const { pathname } = useLocation()

  // Le tunnel de paiement et les feuilles occupent l'écran : y superposer une
  // barre de navigation invite à abandonner au moment de payer.
  //
  // La commande d'un article suit la même règle : elle se termine par un
  // paiement, et proposer trois autres destinations juste sous le bouton de
  // validation est exactement ce qu'il ne faut pas faire.
  // La confirmation fait exception : c'est le dernier écran du tunnel, et on
  // veut justement que le client reparte dans l'application — voir sa
  // réservation, écrire au propriétaire. Le masquer l'y enfermerait.
  const masquee = (pathname.startsWith('/reservation/') && !pathname.endsWith('/confirmee'))
    || pathname.startsWith('/paiement')
    || pathname.endsWith('/commander')
    || /^\/boutique\/commandes\/\d+/.test(pathname)

  if (masquee) return null

  const espace = user ? '/dashboard' : '/login'

  const onglets = [
    { to: '/', libelle: 'Explorer', Icone: Home, exact: true },
    { to: '/hebergements', libelle: 'Recherche', Icone: Search },
    // La boutique n'apparaît que si elle est ouverte : un onglet qui renvoie
    // à l'accueil est pire que pas d'onglet du tout. C'est aussi la seule
    // façon d'y accéder au pouce — sinon il faut remonter au menu du haut.
    ...(boutique.actif
      ? [{ to: '/boutique', libelle: 'Boutique', Icone: Palette, exact: false }]
      : []),
    // La pastille ne se met que sur ce qui attend une réponse d'un humain.
    { to: user ? '/dashboard/reservations' : espace, libelle: 'Réservations', Icone: CalendarDays, pastille: nonLus },
    { to: user ? '/dashboard/profil' : espace, libelle: 'Compte', Icone: User },
  ]

  return (
    <nav
      className="nav-basse"
      aria-label="Navigation principale"
      // Le nombre d'onglets varie avec l'ouverture de la boutique : la
      // répartition doit suivre, sinon le cinquième déborde.
      style={{ gridTemplateColumns: `repeat(${onglets.length}, 1fr)` }}
    >
      {onglets.map(({ to, libelle, Icone, exact, pastille }) => (
        <NavLink
          key={libelle}
          to={to}
          end={exact}
          className={({ isActive }) => `nav-basse-onglet${isActive ? ' est-actif' : ''}`}
        >
          <Icone size={22} strokeWidth={1.9} aria-hidden="true" />
          <span>{libelle}</span>
          {/* Un nombre, jamais un point : « 3 » dit s'il faut ouvrir
              maintenant, un point dit seulement « quelque chose ». */}
          {Boolean(pastille) && (
            <span
              className="nav-basse-pastille"
              aria-label={`${pastille} message${pastille! > 1 ? 's' : ''} en attente`}
            >
              {pastille! > 9 ? '9+' : pastille}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
