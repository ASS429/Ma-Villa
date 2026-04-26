import { useEffect, useRef, useState } from 'react'
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useTheme } from './context/ThemeContext'
import api from './services/api'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import VillaCard from './components/VillaCard'
import ScrollReveal from './components/ScrollReveal'
import Login from './pages/Login'
import Register from './pages/Register'
import NotFound from './pages/NotFound'
import DashboardLayout from './pages/dashboard/DashboardLayout'
import Dashboard from './pages/dashboard/Dashboard'
import MesVillas from './pages/dashboard/MesVillas'
import NouvelleVilla from './pages/dashboard/NouvelleVilla'
import GererVilla from './pages/dashboard/GererVilla'
import Reservations from './pages/dashboard/Reservations'
import Favoris from './pages/dashboard/Favoris'
import Profil from './pages/dashboard/Profil'
import Villas from './pages/public/Villas'
import VillaDetail from './pages/public/VillaDetail'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminVillas from './pages/admin/AdminVillas'
import AdminUtilisateurs from './pages/admin/AdminUtilisateurs'
import AdminAvis from './pages/admin/AdminAvis'

interface Villa {
  id: number
  nom: string
  ville: string
  description: string
  telephone: string
  photos: { url: string; alt: string }[]
  avis: { note: number }[]
  vedette?: boolean
  prix_min?: number
}

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

/* ─── Global video background (all routes except /) ─────────── */

function VideoBackground() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  useEffect(() => {
    if (isHome) {
      document.documentElement.classList.remove('video-mode')
    } else {
      document.documentElement.classList.add('video-mode')
    }
    return () => document.documentElement.classList.remove('video-mode')
  }, [isHome])

  if (isHome) return null

  return (
    <>
      <video
        className="fixed inset-0 w-full h-full object-cover"
        style={{ zIndex: -2 }}
        src="/video_backgroud.mp4"
        autoPlay loop muted playsInline
      />
      <div
        className="fixed inset-0"
        style={{ zIndex: -1, background: 'var(--video-overlay)' }}
      />
    </>
  )
}

/* ─── Cinematic curtain transition ───────────────────────────── */

function CurtainTransition() {
  const location = useLocation()
  const [active, setActive] = useState(false)
  const isFirst = useRef(true)

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return }
    setActive(true)
    const t = setTimeout(() => setActive(false), 750)
    return () => clearTimeout(t)
  }, [location.pathname])

  return <div className={`curtain ${active ? 'active' : ''}`} />
}

/* ─── Featured villas section ────────────────────────────────── */

function FeaturedVillas() {
  const { user } = useAuth()
  const [villas, setVillas] = useState<Villa[]>([])
  const [favorisIds, setFavorisIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    api.get('/villas', { params: { vedette: 1 } })
      .then((res) => {
        const data: Villa[] = res.data.data ?? res.data
        setVillas(data.slice(0, 3))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (user?.role === 'client') {
      api.get('/favoris').then((res) => {
        setFavorisIds(new Set(res.data.map((f: any) => f.villa_id)))
      }).catch(() => {})
    }
  }, [user])

  const toggleFavori = async (e: React.MouseEvent, villaId: number) => {
    e.preventDefault()
    if (!user || user.role !== 'client') return
    if (favorisIds.has(villaId)) {
      await api.delete(`/villas/${villaId}/favoris`)
      setFavorisIds((prev) => { const next = new Set(prev); next.delete(villaId); return next })
    } else {
      await api.post(`/villas/${villaId}/favoris`, {})
      setFavorisIds((prev) => new Set(prev).add(villaId))
    }
  }

  if (villas.length === 0) return null

  return (
    <section className="px-6 md:px-12 lg:px-16 py-20" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-6xl mx-auto">
        <ScrollReveal className="flex items-end justify-between mb-10">
          <div>
            <p className="text-xs mb-2 uppercase tracking-widest font-medium" style={{ color: 'var(--accent)' }}>
              Sélection
            </p>
            <h2 className="text-3xl md:text-4xl font-normal th-text-1" style={{ letterSpacing: '-0.02em' }}>
              Villas en vedette
            </h2>
          </div>
          <Link
            to="/villas"
            className="text-sm transition-colors th-text-2 hover:th-text-1"
          >
            Voir toutes →
          </Link>
        </ScrollReveal>

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
      </div>
    </section>
  )
}

/* ─── Features section ───────────────────────────────────────── */

function Features() {
  const features: { svg: React.ReactNode; label: string; sub: string }[] = [
    {
      svg: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3c-4.97 0-9 4.03-9 9 0 2.39.94 4.57 2.46 6.18M12 3c4.97 0 9 4.03 9 9 0 2.39-.94 4.57-2.46 6.18M12 3v18M3 12h18" /></svg>,
      label: 'Partout au Sénégal',
      sub: 'Dakar, Saly, Mbour, Ziguinchor et plus encore',
    },
    {
      svg: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>,
      label: 'Propriétaires vérifiés',
      sub: 'Chaque annonce est validée par notre équipe',
    },
    {
      svg: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>,
      label: 'Réservation simple',
      sub: 'Disponibilités en temps réel, confirmation rapide',
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
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)',
              }}
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

/* ─── Footer ─────────────────────────────────────────────────── */

function Footer() {
  const { user } = useAuth()
  const dashLink = user?.role === 'admin' ? '/admin' : '/dashboard'
  return (
    <footer className="px-6 md:px-12 lg:px-16 py-8" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <Link
          to="/"
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: '1.35rem',
            fontWeight: 400,
            letterSpacing: '-0.02em',
            color: 'var(--text-1)',
            textDecoration: 'none',
          }}
        >
          Ma Villa
        </Link>
        <div className="flex items-center gap-6 text-sm th-text-2">
          <Link to="/villas" className="hover:th-text-1 transition-colors">Villas</Link>
          {user ? (
            <Link to={dashLink} className="hover:th-text-1 transition-colors">Mon espace</Link>
          ) : (
            <>
              <Link to="/login" className="hover:th-text-1 transition-colors">Connexion</Link>
              <Link to="/register" className="hover:th-text-1 transition-colors">S'inscrire</Link>
            </>
          )}
        </div>
        <span className="text-sm th-text-3">© {new Date().getFullYear()} Ma Villa · Sénégal</span>
      </div>
    </footer>
  )
}

/* ─── Scroll indicator ───────────────────────────────────────── */

function ScrollIndicator() {
  const { isDark } = useTheme()
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY < 80)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <div
      className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 cursor-pointer select-none"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 400ms ease' }}
      onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
    >
      <span className="text-xs tracking-widest uppercase" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(28,25,23,0.4)' }}>
        Découvrir
      </span>
      <svg
        className="w-4 h-4 animate-bounce"
        style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(28,25,23,0.4)' }}
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  )
}

/* ─── Home ───────────────────────────────────────────────────── */

function Home() {
  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text-1)' }}>
      {/* Hero */}
      <div className="min-h-screen flex flex-col relative overflow-hidden">

        {/* Video — les deux thèmes */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at 20% 60%, #0f172a 0%, #000 70%)'
        }} />
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260403_050628_c4e32401-fab4-4a27-b7a8-6e9291cd5959.mp4"
          autoPlay loop muted playsInline
        />
        {/* Léger assombrissement pour la lisibilité du texte */}
        <div className="absolute inset-0 bg-black/25" />

        {/* Content */}
        <div className="relative z-10 flex flex-col flex-1">
          <Navbar />
          <Hero />
          <ScrollIndicator />
        </div>
      </div>

      <FeaturedVillas />
      <Features />
      <Footer />
    </div>
  )
}

/* ─── App ────────────────────────────────────────────────────── */

export default function App() {
  return (
    <>
      <VideoBackground />
      <CurtainTransition />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/villas" element={<Villas />} />
        <Route path="/villas/:id" element={<VillaDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<PrivateRoute><DashboardLayout /></PrivateRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="villas" element={<ProprietaireRoute><MesVillas /></ProprietaireRoute>} />
          <Route path="villas/nouvelle" element={<ProprietaireRoute><NouvelleVilla /></ProprietaireRoute>} />
          <Route path="villas/:id" element={<ProprietaireRoute><GererVilla /></ProprietaireRoute>} />
          <Route path="reservations" element={<Reservations />} />
          <Route path="favoris" element={<Favoris />} />
          <Route path="profil" element={<Profil />} />
        </Route>
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="villas" element={<AdminVillas />} />
          <Route path="utilisateurs" element={<AdminUtilisateurs />} />
          <Route path="avis" element={<AdminAvis />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}
