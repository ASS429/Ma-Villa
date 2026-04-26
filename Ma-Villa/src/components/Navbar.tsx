import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

function IconMenu() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}
function IconX() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
function IconSun() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="5" />
      <path strokeLinecap="round" d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}
function IconMoon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  )
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const close = () => setOpen(false)

  const isHome = location.pathname === '/'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Transparent on home hero, solid elsewhere
  const transparent = isHome && !scrolled
  const dashLink = user?.role === 'admin' ? '/admin' : '/dashboard'
  const dashLabel = user?.role === 'admin' ? 'Admin' : 'Mon espace'

  const navTextClass = transparent
    ? 'text-white/90 hover:text-white'
    : isDark
      ? 'text-gray-400 hover:text-white'
      : 'text-stone-500 hover:text-stone-900'

  return (
    <>
      <div className="px-6 md:px-12 lg:px-16 pt-6 relative z-40">
        <nav
          className="rounded-2xl px-5 py-3 flex items-center justify-between transition-all duration-300"
          style={{
            background: transparent
              ? 'rgba(0,0,0,0.2)'
              : isDark
                ? 'rgba(0,0,0,0.85)'
                : 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: transparent
              ? '1px solid rgba(255,255,255,0.15)'
              : `1px solid var(--border)`,
            boxShadow: transparent ? 'none' : 'var(--shadow-sm)',
          }}
        >
          <Link to="/" onClick={close} className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Ma Villa" className="h-9 w-9 rounded-xl object-contain" />
            <span
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: '1.25rem',
                fontWeight: 400,
                letterSpacing: '-0.02em',
                color: transparent ? '#fff' : 'var(--text-1)',
              }}
            >
              Ma Villa
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-7">
            <NavLink to="/villas" className={`text-sm transition-colors ${navTextClass}`}>
              Villas
            </NavLink>
            {user && (
              <NavLink to={dashLink} className={`text-sm transition-colors ${navTextClass}`}>
                {dashLabel}
              </NavLink>
            )}
          </div>

          {/* Desktop right */}
          <div className="hidden md:flex items-center gap-3">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              title={isDark ? 'Thème clair' : 'Thème sombre'}
              className="p-2 rounded-xl transition-all hover:scale-110"
              style={{ color: transparent ? 'rgba(255,255,255,0.8)' : 'var(--text-2)' }}
            >
              {isDark ? <IconSun /> : <IconMoon />}
            </button>

            {user ? (
              <>
                <span className="text-sm" style={{ color: transparent ? 'rgba(255,255,255,0.7)' : 'var(--text-2)' }}>
                  {user.name}
                </span>
                <button
                  onClick={logout}
                  className="text-sm px-4 py-1.5 rounded-xl border transition-all hover:scale-[1.02]"
                  style={{
                    color: transparent ? '#fff' : 'var(--text-1)',
                    borderColor: transparent ? 'rgba(255,255,255,0.3)' : 'var(--border-2)',
                    background: transparent ? 'rgba(255,255,255,0.1)' : 'var(--bg-input)',
                  }}
                >
                  Déconnexion
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm px-3 py-1.5 transition-colors"
                  style={{ color: transparent ? 'rgba(255,255,255,0.85)' : 'var(--text-2)' }}
                >
                  Connexion
                </Link>
                <Link
                  to="/register"
                  className="text-sm px-5 py-2 rounded-xl font-medium transition-all hover:scale-[1.03] hover:shadow-md"
                  style={{
                    background: transparent ? '#fff' : 'var(--text-1)',
                    color: transparent ? '#1C1917' : 'var(--bg)',
                  }}
                >
                  S'inscrire
                </Link>
              </>
            )}
          </div>

          {/* Mobile: theme toggle + hamburger */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl transition-colors"
              style={{ color: transparent ? 'rgba(255,255,255,0.8)' : 'var(--text-2)' }}
            >
              {isDark ? <IconSun /> : <IconMoon />}
            </button>
            <button
              className="p-1.5 rounded-xl transition-colors"
              style={{ color: transparent ? '#fff' : 'var(--text-1)' }}
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
            >
              {open ? <IconX /> : <IconMenu />}
            </button>
          </div>
        </nav>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={close}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="absolute top-0 right-0 h-full w-72 flex flex-col"
            style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.25rem', fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--text-1)' }}>Ma Villa</span>
              <button onClick={close} className="th-text-2 hover:th-text-1 transition-colors">
                <IconX />
              </button>
            </div>

            <nav className="flex-1 flex flex-col px-4 py-4 gap-1">
              <MobileLink to="/villas" onClick={close}>Villas</MobileLink>
              {user && <MobileLink to={dashLink} onClick={close}>{dashLabel}</MobileLink>}
            </nav>

            <div className="px-4 py-6" style={{ borderTop: '1px solid var(--border)' }}>
              {user ? (
                <div className="flex flex-col gap-3">
                  <p className="text-xs px-2 th-text-3">{user.name}</p>
                  <button
                    onClick={() => { logout(); close() }}
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium text-left transition-colors th-text-2 hover:th-text-1"
                    style={{ border: '1px solid var(--border)' }}
                  >
                    Déconnexion
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <MobileLink to="/login" onClick={close}>Connexion</MobileLink>
                  <Link
                    to="/register"
                    onClick={close}
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium text-center transition-colors"
                    style={{ background: 'var(--text-1)', color: 'var(--bg)' }}
                  >
                    S'inscrire
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function MobileLink({ to, onClick, children }: { to: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
          isActive ? 'th-elevated th-text-1' : 'th-text-2 hover:th-elevated hover:th-text-1'
        }`
      }
    >
      {children}
    </NavLink>
  )
}
