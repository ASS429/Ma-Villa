import { Suspense, lazy, useEffect, useState } from 'react'
import { Routes, Route, Navigate, Link, useParams } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useToast } from './context/ToastContext'
import api from './services/api'
import { messageErreur } from './lib/erreurs'
import type { VillaResume } from './types'
import ChargementPage from './components/ChargementPage'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import FondHero from './components/FondHero'
import VillaCard from './components/VillaCard'
import ScrollReveal from './components/ScrollReveal'
import ChoixCategorie from './components/recherche/ChoixCategorie'
import Destinations from './components/Destinations'
import Footer from './components/Footer'
import NavigationBasse from './components/app/NavigationBasse'
import InvitationInstallation from './components/app/InvitationInstallation'
import NouvelleVersion from './components/NouvelleVersion'
import { ButtonLink } from './components/ui/Button'
import Seo from './components/Seo'
import { VillaCardSkeleton } from './components/Skeleton'
import Login from './pages/Login'
import Register from './pages/Register'
import MotDePasseOublie from './pages/MotDePasseOublie'
import ReinitialiserMotDePasse from './pages/ReinitialiserMotDePasse'
import EmailVerifie from './pages/EmailVerifie'
import NotFound from './pages/NotFound'
import Villas from './pages/public/Villas'
import VillaDetail from './pages/public/VillaDetail'
import PageLegale from './pages/legal/PageLegale'

/* ─── Espaces privés : chargés à la demande ──────────────────────
   Le tableau de bord et l'administration représentent l'essentiel du code
   applicatif, alors que la grande majorité des visiteurs ne les ouvre jamais.
   Les sortir du paquet initial allège la première visite.                    */

const DashboardLayout = lazy(() => import('./pages/dashboard/DashboardLayout'))
const Dashboard       = lazy(() => import('./pages/dashboard/Dashboard'))
const MesVillas       = lazy(() => import('./pages/dashboard/MesVillas'))
const NouvelleVilla   = lazy(() => import('./pages/dashboard/NouvelleVilla'))
const GererVilla      = lazy(() => import('./pages/dashboard/GererVilla'))
const Reservations    = lazy(() => import('./pages/dashboard/Reservations'))
const Favoris         = lazy(() => import('./pages/dashboard/Favoris'))
const Profil          = lazy(() => import('./pages/dashboard/Profil'))
const Conversation    = lazy(() => import('./pages/dashboard/Conversation'))
// Boutique : chargee a la demande. Tant que BOUTIQUE_ACTIVE est fermee,
// personne n'atteint ces ecrans et leur code ne part jamais sur le reseau.
const Boutique        = lazy(() => import('./pages/boutique/Boutique'))
const OeuvreDetail    = lazy(() => import('./pages/boutique/OeuvreDetail'))
const Commander       = lazy(() => import('./pages/boutique/Commander'))
const MesCommandes    = lazy(() => import('./pages/boutique/MesCommandes'))
const CommandeDetail  = lazy(() => import('./pages/boutique/CommandeDetail'))
const Revenus         = lazy(() => import('./pages/dashboard/Revenus'))

// Le tunnel de paiement ne concerne qu'un client qui réserve : hors du
// paquet initial, comme les espaces privés.
const Paiement  = lazy(() => import('./pages/paiement/Paiement'))
const Confirmee = lazy(() => import('./pages/paiement/Confirmee'))

const AdminLayout       = lazy(() => import('./pages/admin/AdminLayout'))
const AdminAttentes     = lazy(() => import('./pages/admin/AdminAttentes'))
const AdminDashboard    = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminVillas       = lazy(() => import('./pages/admin/AdminVillas'))
const AdminUtilisateurs = lazy(() => import('./pages/admin/AdminUtilisateurs'))
const AdminAvis         = lazy(() => import('./pages/admin/AdminAvis'))
const AdminPaiement     = lazy(() => import('./pages/admin/AdminPaiement'))
const AdminNotifications = lazy(() => import('./pages/admin/AdminNotifications'))
const AdminCourriel     = lazy(() => import('./pages/admin/AdminCourriel'))
const AdminJournal      = lazy(() => import('./pages/admin/AdminJournal'))
const AdminReversements = lazy(() => import('./pages/admin/AdminReversements'))
const AdminRemboursements = lazy(() => import('./pages/admin/AdminRemboursements'))
const AdminDeboursement = lazy(() => import('./pages/admin/AdminDeboursement'))
const AdminOeuvres      = lazy(() => import('./pages/admin/AdminOeuvres'))
const AdminCommandes    = lazy(() => import('./pages/admin/AdminCommandes'))

/* ─── Route guards ───────────────────────────────────────────── */

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  return user ? <>{children}</> : <Navigate to="/login" replace />
}
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
function ProprietaireRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'proprietaire') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}


/* ─── Villas en vedette ──────────────────────────────────────── */

function FeaturedVillas() {
  const { user } = useAuth()
  const toast = useToast()
  const [villas, setVillas] = useState<VillaResume[]>([])
  const [chargement, setChargement] = useState(true)
  const [favorisIds, setFavorisIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    api.get('/villas', { params: { vedette: 1 } })
      .then((res) => setVillas((res.data.data ?? res.data).slice(0, 3)))
      .catch(() => setVillas([]))
      .finally(() => setChargement(false))
  }, [])

  useEffect(() => {
    if (user?.role !== 'client') return
    api.get('/favoris')
      .then((res) => setFavorisIds(new Set(res.data.map((f: { villa_id: number }) => f.villa_id))))
      .catch(() => { /* liste de favoris indisponible : la page reste utilisable */ })
  }, [user])

  const toggleFavori = async (e: React.MouseEvent, villaId: number) => {
    e.preventDefault()
    if (!user || user.role !== 'client') return

    const etaitFavori = favorisIds.has(villaId)
    try {
      if (etaitFavori) {
        await api.delete(`/villas/${villaId}/favoris`)
        setFavorisIds((p) => { const n = new Set(p); n.delete(villaId); return n })
      } else {
        await api.post(`/villas/${villaId}/favoris`, {})
        setFavorisIds((p) => new Set(p).add(villaId))
      }
    } catch (err) {
      toast.erreur(messageErreur(err, 'Impossible de mettre à jour vos favoris.'))
    }
  }

  if (!chargement && villas.length === 0) return null

  return (
    <section className="px-6 md:px-12 lg:px-16 py-20" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-6xl mx-auto">
        <ScrollReveal className="flex items-end justify-between mb-10">
          <div>
            <p className="text-xs mb-2 uppercase tracking-widest font-semibold" style={{ color: 'var(--accent)' }}>
              Sélection
            </p>
            <h2 className="text-3xl md:text-4xl font-normal th-text-1" style={{ letterSpacing: '-0.02em' }}>
              Villas en vedette
            </h2>
          </div>
          <Link to="/hebergements" className="text-sm transition-colors th-text-2 hover:th-text-1">
            Voir toutes →
          </Link>
        </ScrollReveal>

        {chargement ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => <VillaCardSkeleton key={n} />)}
          </div>
        ) : (
          <ScrollReveal className="sr-stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {villas.map((v) => (
              <VillaCard
                key={v.id}
                villa={v}
                isFavori={favorisIds.has(v.id)}
                onToggleFavori={user?.role === 'client' ? (e) => toggleFavori(e, v.id) : undefined}
              />
            ))}
          </ScrollReveal>
        )}
      </div>
    </section>
  )
}

/* ─── Comment ça marche ──────────────────────────────────────── */

function CommentCaMarche() {
  const etapes = [
    { n: '1', titre: 'Cherchez', texte: 'Filtrez par ville, dates et budget. Les prix sont affichés, sans surprise.' },
    { n: '2', titre: 'Réservez', texte: 'Choisissez un logement et une formule : à la nuitée, à la journée ou à la demi-journée.' },
    { n: '3', titre: 'Profitez', texte: 'Le propriétaire confirme, vous recevez ses coordonnées par email.' },
  ]

  return (
    <section className="px-6 md:px-12 lg:px-16 py-20" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-6xl mx-auto">
        <ScrollReveal>
          <p className="text-xs mb-2 uppercase tracking-widest font-semibold" style={{ color: 'var(--accent)' }}>
            Comment ça marche
          </p>
          <h2 className="text-3xl md:text-4xl font-normal th-text-1 mb-10" style={{ letterSpacing: '-0.02em' }}>
            Réserver en trois étapes
          </h2>
        </ScrollReveal>

        <ScrollReveal className="sr-stagger grid grid-cols-1 md:grid-cols-3 gap-5">
          {etapes.map(({ n, titre, texte }) => (
            <div
              key={n}
              className="rounded-2xl px-6 py-8"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 font-semibold"
                style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}
              >
                {n}
              </div>
              <p className="font-semibold mb-2 th-text-1">{titre}</p>
              <p className="text-sm th-text-2 leading-relaxed">{texte}</p>
            </div>
          ))}
        </ScrollReveal>
      </div>
    </section>
  )
}

/* ─── Arguments ──────────────────────────────────────────────── */

function Features() {
  const features = [
    {
      svg: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3c-4.97 0-9 4.03-9 9 0 2.39.94 4.57 2.46 6.18M12 3c4.97 0 9 4.03 9 9 0 2.39-.94 4.57-2.46 6.18M12 3v18M3 12h18" /></svg>,
      label: 'Partout au Sénégal',
      sub: 'Saly, Mbour, Dakar, Ziguinchor et plus encore',
    },
    {
      svg: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>,
      label: 'Annonces vérifiées',
      sub: 'Chaque villa est contrôlée par notre équipe avant publication',
    },
    {
      svg: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 8v-.5A2.5 2.5 0 0013.5 5h-3A2.5 2.5 0 008 7.5v9a2.5 2.5 0 002.5 2.5h3a2.5 2.5 0 002.5-2.5V16M12 12h9m0 0l-2.5-2.5M21 12l-2.5 2.5" /></svg>,
      label: 'Avis de vrais séjours',
      sub: 'Seuls les clients ayant séjourné peuvent laisser une note',
    },
  ]

  return (
    <section className="px-6 md:px-12 lg:px-16 py-20" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-6xl mx-auto">
        <ScrollReveal className="sr-stagger grid grid-cols-1 md:grid-cols-3 gap-5">
          {features.map(({ svg, label, sub }) => (
            <div
              key={label}
              className="rounded-2xl px-6 py-8 transition-all hover:-translate-y-1"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}
              >
                {svg}
              </div>
              <p className="font-semibold mb-2 th-text-1">{label}</p>
              <p className="text-sm th-text-2 leading-relaxed">{sub}</p>
            </div>
          ))}
        </ScrollReveal>
      </div>
    </section>
  )
}

/* ─── Appel aux propriétaires ────────────────────────────────── */

function AppelProprietaires() {
  return (
    <section className="px-6 md:px-12 lg:px-16 py-20" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-6xl mx-auto">
        <ScrollReveal className="rounded-2xl px-6 py-12 md:px-12 text-center th-card">
          <p className="text-xs mb-3 uppercase tracking-widest font-semibold" style={{ color: 'var(--accent)' }}>
            Propriétaires
          </p>
          <h2 className="text-3xl md:text-4xl font-normal th-text-1 mb-4" style={{ letterSpacing: '-0.02em' }}>
            Publiez votre hébergement gratuitement
          </h2>
          <p className="text-sm th-text-2 max-w-xl mx-auto mb-8 leading-relaxed">
            Créez votre annonce, fixez vos tarifs par formule — nuitée, journée,
            résidence — et gérez vos disponibilités depuis un tableau de bord simple.
          </p>
          {/* Seul endroit où « Publier mon hébergement » prend l'accent : c'est la
              section qui lui est consacrée, donc la conversion du parcours en
              cours. Ailleurs, elle reste secondaire pour ne pas détourner la
              couleur d'action vers une action qui ne concerne pas le client. */}
          <ButtonLink to="/register" variante="primaire" taille="md">
            Publier mon hébergement
          </ButtonLink>
        </ScrollReveal>
      </div>
    </section>
  )
}

/* ─── Accueil ────────────────────────────────────────────────── */

function Home() {
  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text-1)' }}>
      <Seo
        titre="PasseTemps"
        description="Louez une villa, une résidence, un appartement ou une chambre au Sénégal — Saly, Mbour, Dakar. Tarifs affichés, disponibilités en temps réel, réservation directe auprès des propriétaires."
        chemin="/"
        donneesStructurees={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'PasseTemps',
          description: 'Villas, résidences, appartements et chambres à louer au Sénégal',
          inLanguage: 'fr',
          potentialAction: {
            '@type': 'SearchAction',
            target: `${window.location.origin}/hebergements?ville={search_term_string}`,
            'query-input': 'required name=search_term_string',
          },
        }}
      />

      <div className="min-h-screen flex flex-col relative overflow-hidden">
        <FondHero />
        <div className="relative z-10 flex flex-col flex-1">
          <Navbar />
          <Hero />
        </div>
      </div>

      {/* « Que cherchez-vous ? » avant « Où ? » : chercher un lieu sans
          savoir ce qu'on loue oblige à filtrer ensuite dans un catalogue
          mélangé, où une chambre à la nuitée côtoie un studio au mois. */}
      <section className="px-6 md:px-12 lg:px-16 py-16" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-3xl mx-auto">
          <ScrollReveal className="mb-8">
            <p
              className="mb-2"
              style={{ font: 'var(--t-eyebrow)', letterSpacing: 'var(--t-eyebrow-ls)', textTransform: 'uppercase', color: 'var(--accent)' }}
            >
              Par catégorie
            </p>
            <h2 className="th-text-1" style={{ font: 'var(--t-h2)', letterSpacing: 'var(--t-h2-ls)' }}>
              Que cherchez-vous ?
            </h2>
          </ScrollReveal>
          <ChoixCategorie />
        </div>
      </section>

      <Destinations />
      <FeaturedVillas />
      <CommentCaMarche />
      <Features />
      <AppelProprietaires />
      <Footer />
    </div>
  )
}

/**
 * `/villas/12` → `/hebergements/12`, en gardant la barre oblique finale.
 *
 * Elle n'est pas décorative : Render applique sa réécriture avant de résoudre
 * l'index d'un dossier, et c'est elle qui distingue la page pré-rendue du
 * gabarit générique.
 */
function RedirectionHebergement() {
  const { id } = useParams()
  return <Navigate to={`/hebergements/${id}/`} replace />
}

/* ─── App ────────────────────────────────────────────────────── */

export default function App() {
  return (
    <>
      <NouvelleVersion />

      {/* Lien d'évitement : au clavier, atteindre le contenu demandait de
          traverser toute la navigation à chaque changement de page. Il n'est
          visible qu'une fois au focus — c'est sa seule raison d'exister. */}
      <a href="#contenu" className="lien-evitement">Aller au contenu</a>

      {/* Point de repère principal : sans lui, un lecteur d'écran n'offre
          aucun raccourci vers le contenu et il faut tout parcourir. */}
      <main id="contenu">
      <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/hebergements" element={<Villas />} />
      <Route path="/hebergements/:id" element={<VillaDetail />} />

      {/* Les anciennes adresses continuent de répondre, et pour longtemps.
          La plupart des visiteurs arrivent par un lien WhatsApp vers
          `/villas/{id}` : casser ces liens perdrait exactement les clients
          que la page de reprise a été écrite pour rattraper. La redirection
          remplace l'entrée d'historique, pour que le retour arrière ne
          reboucle pas sur elle. */}
      <Route path="/villas" element={<Navigate to="/hebergements" replace />} />
      <Route path="/villas/:id" element={<RedirectionHebergement />} />

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
      <Route path="/reinitialiser-mot-de-passe" element={<ReinitialiserMotDePasse />} />
      <Route path="/email-verifie" element={<EmailVerifie />} />

        <Route
          path="/reservation/:id/paiement"
          element={<PrivateRoute><Suspense fallback={<ChargementPage />}><Paiement /></Suspense></PrivateRoute>}
        />
        <Route
          path="/reservation/:id/confirmee"
          element={<PrivateRoute><Suspense fallback={<ChargementPage />}><Confirmee /></Suspense></PrivateRoute>}
        />

      <Route path="/conditions-generales" element={<PageLegale document="cgu" />} />
      <Route path="/confidentialite" element={<PageLegale document="confidentialite" />} />
      <Route path="/annulation" element={<PageLegale document="annulation" />} />
      <Route path="/mentions-legales" element={<PageLegale document="mentions" />} />
      {/* La boutique est une vente pour compte propre, pas une mise en
          relation : elle ne relève pas des mêmes règles que la location,
          d'où un document distinct plutôt qu'un article de plus. */}
      <Route path="/conditions-vente" element={<PageLegale document="vente" />} />

      {/* Boutique. Les ecrans se gardent eux-memes : ferme, on redirige
          vers l'accueil plutot que d'afficher une page vide. */}
      <Route path="/boutique" element={<Suspense fallback={<ChargementPage />}><Boutique /></Suspense>} />
      <Route path="/boutique/commandes" element={<PrivateRoute><Suspense fallback={<ChargementPage />}><MesCommandes /></Suspense></PrivateRoute>} />
      <Route path="/boutique/commandes/:id" element={<PrivateRoute><Suspense fallback={<ChargementPage />}><CommandeDetail /></Suspense></PrivateRoute>} />
      <Route path="/boutique/:id" element={<Suspense fallback={<ChargementPage />}><OeuvreDetail /></Suspense>} />
      <Route path="/boutique/:id/commander" element={<PrivateRoute><Suspense fallback={<ChargementPage />}><Commander /></Suspense></PrivateRoute>} />

      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <Suspense fallback={<ChargementPage />}>
              <DashboardLayout />
            </Suspense>
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="villas" element={<ProprietaireRoute><MesVillas /></ProprietaireRoute>} />
        <Route path="villas/nouvelle" element={<ProprietaireRoute><NouvelleVilla /></ProprietaireRoute>} />
        <Route path="villas/:id" element={<ProprietaireRoute><GererVilla /></ProprietaireRoute>} />
        <Route path="reservations" element={<Reservations />} />
        <Route path="reservations/:id/messages" element={<Conversation />} />
        <Route path="revenus" element={<ProprietaireRoute><Revenus /></ProprietaireRoute>} />
        <Route path="favoris" element={<Favoris />} />
        <Route path="profil" element={<Profil />} />
      </Route>

      <Route
        path="/admin"
        element={
          <AdminRoute>
            <Suspense fallback={<ChargementPage />}>
              <AdminLayout />
            </Suspense>
          </AdminRoute>
        }
      >
        {/* L'accueil répond à « ai-je du travail ? ». Le tableau de bord, qui
            occupait cette place, répondait à « comment va la plateforme ? » —
            une bonne question, mais pas celle du matin. Il garde son écran. */}
        <Route index element={<AdminAttentes />} />
        <Route path="tableau-de-bord" element={<AdminDashboard />} />
        <Route path="villas" element={<AdminVillas />} />
        <Route path="utilisateurs" element={<AdminUtilisateurs />} />
        <Route path="avis" element={<AdminAvis />} />
        <Route path="paiement" element={<AdminPaiement />} />
        <Route path="notifications" element={<AdminNotifications />} />
        <Route path="courriel" element={<AdminCourriel />} />
        <Route path="journal" element={<AdminJournal />} />
        <Route path="reversements" element={<AdminReversements />} />
        <Route path="remboursements" element={<AdminRemboursements />} />
        <Route path="deboursement" element={<AdminDeboursement />} />
        <Route path="oeuvres" element={<AdminOeuvres />} />
        <Route path="commandes" element={<AdminCommandes />} />
      </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      </main>

      {/* Châssis d'application : la destination est atteinte au pouce,
          sans remonter chercher un menu en haut d'écran. */}
      <NavigationBasse />

      {/* Proposée seulement après quelques écrans, et jamais deux fois après
          un refus : le navigateur ne redonne pas de seconde chance. */}
      <InvitationInstallation />
    </>
  )
}
