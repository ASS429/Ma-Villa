import { Suspense, lazy, useEffect, useState } from 'react'
import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useToast } from './context/ToastContext'
import api from './services/api'
import { messageErreur } from './lib/erreurs'
import type { VillaResume } from './types'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import FondHero from './components/FondHero'
import VillaCard from './components/VillaCard'
import ScrollReveal from './components/ScrollReveal'
import Footer from './components/Footer'
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

const AdminLayout       = lazy(() => import('./pages/admin/AdminLayout'))
const AdminDashboard    = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminVillas       = lazy(() => import('./pages/admin/AdminVillas'))
const AdminUtilisateurs = lazy(() => import('./pages/admin/AdminUtilisateurs'))
const AdminAvis         = lazy(() => import('./pages/admin/AdminAvis'))

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

function ChargementPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-8 h-8 rounded-full animate-spin"
          style={{ border: '2px solid var(--border)', borderTopColor: 'var(--accent)' }}
        />
        <p className="text-sm th-text-2">Chargement…</p>
      </div>
    </div>
  )
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
          <Link to="/villas" className="text-sm transition-colors th-text-2 hover:th-text-1">
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
    { n: '2', titre: 'Réservez', texte: 'Choisissez un logement et une formule : nuitée, journée, ou piscine seule.' },
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
            Publiez votre villa gratuitement
          </h2>
          <p className="text-sm th-text-2 max-w-xl mx-auto mb-8 leading-relaxed">
            Créez votre annonce, fixez vos tarifs par formule — nuitée, journée,
            piscine seule — et gérez vos disponibilités depuis un tableau de bord simple.
          </p>
          {/* Seul endroit où « Publier ma villa » prend l'accent : c'est la
              section qui lui est consacrée, donc la conversion du parcours en
              cours. Ailleurs, elle reste secondaire pour ne pas détourner la
              couleur d'action vers une action qui ne concerne pas le client. */}
          <ButtonLink to="/register" variante="primaire" taille="md">
            Publier ma villa
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
        titre="Ma Villa"
        description="Louez une villa, un appartement ou une piscine à la journée au Sénégal — Saly, Mbour, Dakar. Tarifs affichés, disponibilités en temps réel, réservation directe auprès des propriétaires."
        chemin="/"
        donneesStructurees={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'Ma Villa',
          description: 'Location de villas et logements de vacances au Sénégal',
          inLanguage: 'fr',
          potentialAction: {
            '@type': 'SearchAction',
            target: `${window.location.origin}/villas?ville={search_term_string}`,
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

      <FeaturedVillas />
      <CommentCaMarche />
      <Features />
      <AppelProprietaires />
      <Footer />
    </div>
  )
}

/* ─── App ────────────────────────────────────────────────────── */

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/villas" element={<Villas />} />
      <Route path="/villas/:id" element={<VillaDetail />} />

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
      <Route path="/reinitialiser-mot-de-passe" element={<ReinitialiserMotDePasse />} />
      <Route path="/email-verifie" element={<EmailVerifie />} />

      <Route path="/conditions-generales" element={<PageLegale document="cgu" />} />
      <Route path="/confidentialite" element={<PageLegale document="confidentialite" />} />
      <Route path="/annulation" element={<PageLegale document="annulation" />} />
      <Route path="/mentions-legales" element={<PageLegale document="mentions" />} />

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
        <Route index element={<AdminDashboard />} />
        <Route path="villas" element={<AdminVillas />} />
        <Route path="utilisateurs" element={<AdminUtilisateurs />} />
        <Route path="avis" element={<AdminAvis />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
