import { Fragment, Suspense, lazy, useEffect, useState } from 'react'
import { Routes, Route, Navigate, Link, useParams, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useToast } from './context/ToastContext'
import { useConfig } from './context/ConfigContext'
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
import Destination from './pages/public/Destination'
import PageLegale from './pages/legal/PageLegale'
import BandeauJoj from './joj/BandeauJoj'
import LangueDocument from './i18n/LangueDocument'
import { prefixes, useLangue } from './i18n/langue'
import { COMMUN } from './i18n/commun'
import { TEXTES_ACCUEIL } from './i18n/accueil'

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
// Les services aux voyageurs et la vitrine des JOJ portent deux langues de
// textes : hors du paquet initial, que la plupart des visiteurs chargent sans eux.
const PageService     = lazy(() => import('./prestations/PageService'))
const PageJoj         = lazy(() => import('./joj/PageJoj'))

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
const AdminDemandes     = lazy(() => import('./pages/admin/AdminDemandes'))

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
  const { langue, lien } = useLangue()
  const t = TEXTES_ACCUEIL[langue].vedette
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
      toast.erreur(messageErreur(err, t.favorisImpossible))
    }
  }

  if (!chargement && villas.length === 0) return null

  return (
    <section className="px-6 md:px-12 lg:px-16 py-20" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-6xl mx-auto">
        <ScrollReveal className="flex items-end justify-between mb-10">
          <div>
            <p className="text-xs mb-2 uppercase tracking-widest font-semibold" style={{ color: 'var(--accent)' }}>
              {t.eyebrow}
            </p>
            <h2 className="text-3xl md:text-4xl font-normal th-text-1" style={{ letterSpacing: '-0.02em' }}>
              {t.titre}
            </h2>
          </div>
          <Link to={lien('/hebergements/')} className="text-sm transition-colors th-text-2 hover:th-text-1">
            {t.voirTout}
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
  const { reservations } = useConfig()
  const t = TEXTES_ACCUEIL[useLangue().langue].etapes
  const cherchez = { n: '1', ...t.cherchez }

  // Suspendue, la réservation en ligne ne peut pas être l'étape 2 : le parcours
  // annoncé doit être celui qu'on peut réellement suivre aujourd'hui.
  const etapes = reservations.ouvertes
    ? [
        cherchez,
        { n: '2', ...t.reservez },
        { n: '3', ...t.profitezOuvert },
      ]
    : [
        cherchez,
        { n: '2', ...t.contactez(reservations.contact.nom, reservations.contact.telephone) },
        { n: '3', ...t.profitezFerme },
      ]

  return (
    <section className="px-6 md:px-12 lg:px-16 py-20" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-6xl mx-auto">
        <ScrollReveal>
          <p className="text-xs mb-2 uppercase tracking-widest font-semibold" style={{ color: 'var(--accent)' }}>
            {t.eyebrow}
          </p>
          <h2 className="text-3xl md:text-4xl font-normal th-text-1 mb-10" style={{ letterSpacing: '-0.02em' }}>
            {t.titre}
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
  const textes = TEXTES_ACCUEIL[useLangue().langue].arguments
  const icones = [
    {
      svg: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3c-4.97 0-9 4.03-9 9 0 2.39.94 4.57 2.46 6.18M12 3c4.97 0 9 4.03 9 9 0 2.39-.94 4.57-2.46 6.18M12 3v18M3 12h18" /></svg>,
    },
    {
      svg: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>,
    },
    {
      svg: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 8v-.5A2.5 2.5 0 0013.5 5h-3A2.5 2.5 0 008 7.5v9a2.5 2.5 0 002.5 2.5h3a2.5 2.5 0 002.5-2.5V16M12 12h9m0 0l-2.5-2.5M21 12l-2.5 2.5" /></svg>,
    },
  ]
  const features = icones.map(({ svg }, i) => ({ svg, ...textes[i] }))

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
  const { langue, lien } = useLangue()
  const t = TEXTES_ACCUEIL[langue].proprietaires
  return (
    <section className="px-6 md:px-12 lg:px-16 py-20" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-6xl mx-auto">
        <ScrollReveal className="rounded-2xl px-6 py-12 md:px-12 text-center th-card">
          <p className="text-xs mb-3 uppercase tracking-widest font-semibold" style={{ color: 'var(--accent)' }}>
            {t.eyebrow}
          </p>
          <h2 className="text-3xl md:text-4xl font-normal th-text-1 mb-4" style={{ letterSpacing: '-0.02em' }}>
            {t.titre}
          </h2>
          <p className="text-sm th-text-2 max-w-xl mx-auto mb-8 leading-relaxed">
            {t.texte}
          </p>
          {/* Seul endroit où « Publier mon hébergement » prend l'accent : c'est la
              section qui lui est consacrée, donc la conversion du parcours en
              cours. Ailleurs, elle reste secondaire pour ne pas détourner la
              couleur d'action vers une action qui ne concerne pas le client. */}
          <ButtonLink to={lien('/register')} variante="primaire" taille="md">
            {t.bouton}
          </ButtonLink>
        </ScrollReveal>
      </div>
    </section>
  )
}

/* ─── Accueil ────────────────────────────────────────────────── */

function Home() {
  const { langue, lien } = useLangue()
  const t = TEXTES_ACCUEIL[langue]
  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text-1)' }}>
      <Seo
        titre="PasseTemps"
        description={t.seo.description}
        chemin={lien('/')}
        donneesStructurees={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'PasseTemps',
          description: t.seo.site,
          inLanguage: langue,
          potentialAction: {
            '@type': 'SearchAction',
            target: `${window.location.origin}${lien('/hebergements')}?ville={search_term_string}`,
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

      <BandeauJoj />

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
              {t.categories.eyebrow}
            </p>
            <h2 className="th-text-1" style={{ font: 'var(--t-h2)', letterSpacing: 'var(--t-h2-ls)' }}>
              {t.categories.titre}
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

/**
 * L'ancienne liste, **avec sa requête**.
 *
 * `<Navigate to="/hebergements/">` la laissait tomber : un lien
 * `/villas?ville=Saly` déjà partagé arrivait sur le catalogue entier, et les
 * pastilles de catégorie — qui pointaient là — semblaient ne rien faire.
 */
function RedirectionHebergements() {
  const { search } = useLocation()
  return <Navigate to={{ pathname: '/hebergements', search }} replace />
}

/** Le lien d'évitement, dans la langue de la page. */
function LienEvitement() {
  const { langue } = useLangue()
  return <a href="#contenu" className="lien-evitement">{COMMUN[langue].nav.allerAuContenu}</a>
}

/* ─── Les routes client, dans chaque langue ──────────────────────
   Les pages que voit un client existent en français (à la racine) et en
   anglais (sous `/en`). Celles des propriétaires et de la console restent
   en français seulement : voir `src/i18n/langue.ts`. Une page pas encore
   traduite répond déjà sous `/en/…`, en français : un lien d'une page
   anglaise ne doit jamais mener à une page introuvable. */

function routesClient(p: string) {
  return (
    <Fragment key={p || 'fr'}>
      <Route path={p || '/'} element={<Home />} />
      <Route path={`${p}/hebergements`} element={<Villas />} />
      <Route path={`${p}/hebergements/:id`} element={<VillaDetail />} />

      {/* Une page par ville, parce qu'un `?ville=` ne se pré-rend pas et
          n'entre pas au plan de site. C'est la porte d'entrée depuis Google
          sur « location villa Saly ». */}
      <Route path={`${p}/destinations/:ville`} element={<Destination />} />

      {/* Les services aux voyageurs, chacun sa page — permanents. */}
      <Route path={`${p}/transport`} element={<Suspense fallback={<ChargementPage />}><PageService famille="transport" /></Suspense>} />
      <Route path={`${p}/restauration`} element={<Suspense fallback={<ChargementPage />}><PageService famille="restauration" /></Suspense>} />

      {/* La vitrine temporaire des JOJ Dakar 2026 : à retirer après les Jeux
          avec tout `src/joj/` — voir docs/16-RETRAIT-JOJ.md. */}
      <Route path={`${p}/joj-dakar-2026`} element={<Suspense fallback={<ChargementPage />}><PageJoj /></Suspense>} />

      <Route path={`${p}/login`} element={<Login />} />
      <Route path={`${p}/register`} element={<Register />} />
      <Route path={`${p}/mot-de-passe-oublie`} element={<MotDePasseOublie />} />
      <Route path={`${p}/reinitialiser-mot-de-passe`} element={<ReinitialiserMotDePasse />} />
      <Route path={`${p}/email-verifie`} element={<EmailVerifie />} />

        <Route
          path={`${p}/reservation/:id/paiement`}
          element={<PrivateRoute><Suspense fallback={<ChargementPage />}><Paiement /></Suspense></PrivateRoute>}
        />
        <Route
          path={`${p}/reservation/:id/confirmee`}
          element={<PrivateRoute><Suspense fallback={<ChargementPage />}><Confirmee /></Suspense></PrivateRoute>}
        />

      <Route path={`${p}/conditions-generales`} element={<PageLegale document="cgu" />} />
      <Route path={`${p}/confidentialite`} element={<PageLegale document="confidentialite" />} />
      <Route path={`${p}/annulation`} element={<PageLegale document="annulation" />} />
      <Route path={`${p}/mentions-legales`} element={<PageLegale document="mentions" />} />
      {/* La boutique est une vente pour compte propre, pas une mise en
          relation : elle ne relève pas des mêmes règles que la location,
          d'où un document distinct plutôt qu'un article de plus. */}
      <Route path={`${p}/conditions-vente`} element={<PageLegale document="vente" />} />

      {/* Boutique. Les ecrans se gardent eux-memes : ferme, on redirige
          vers l'accueil plutot que d'afficher une page vide. */}
      <Route path={`${p}/boutique`} element={<Suspense fallback={<ChargementPage />}><Boutique /></Suspense>} />
      <Route path={`${p}/boutique/commandes`} element={<PrivateRoute><Suspense fallback={<ChargementPage />}><MesCommandes /></Suspense></PrivateRoute>} />
      <Route path={`${p}/boutique/commandes/:id`} element={<PrivateRoute><Suspense fallback={<ChargementPage />}><CommandeDetail /></Suspense></PrivateRoute>} />
      <Route path={`${p}/boutique/:id`} element={<Suspense fallback={<ChargementPage />}><OeuvreDetail /></Suspense>} />
      <Route path={`${p}/boutique/:id/commander`} element={<PrivateRoute><Suspense fallback={<ChargementPage />}><Commander /></Suspense></PrivateRoute>} />
    </Fragment>
  )
}

/* ─── App ────────────────────────────────────────────────────── */

export default function App() {
  return (
    <>
      <NouvelleVersion />
      <LangueDocument />

      {/* Lien d'évitement : au clavier, atteindre le contenu demandait de
          traverser toute la navigation à chaque changement de page. Il n'est
          visible qu'une fois au focus — c'est sa seule raison d'exister. */}
      <LienEvitement />

      {/* Point de repère principal : sans lui, un lecteur d'écran n'offre
          aucun raccourci vers le contenu et il faut tout parcourir. */}
      <main id="contenu">
      <Routes>
      {prefixes().map(routesClient)}

      {/* Les anciennes adresses continuent de répondre, et pour longtemps.
          La plupart des visiteurs arrivent par un lien WhatsApp vers
          `/villas/{id}` : casser ces liens perdrait exactement les clients
          que la page de reprise a été écrite pour rattraper. La redirection
          remplace l'entrée d'historique, pour que le retour arrière ne
          reboucle pas sur elle. */}
      <Route path="/villas" element={<RedirectionHebergements />} />
      <Route path="/villas/:id" element={<RedirectionHebergement />} />

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
        <Route path="demandes" element={<AdminDemandes />} />
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
