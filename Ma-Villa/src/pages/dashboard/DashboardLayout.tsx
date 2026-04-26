import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'

type NavItem = { to: string; label: string; Icon: () => React.ReactElement; end?: boolean }

const proprietaireLinks: NavItem[] = [
  { to: '/dashboard',              label: 'Accueil',        Icon: IconHome,     end: true },
  { to: '/dashboard/villas',       label: 'Mes villas',     Icon: IconBuilding        },
  { to: '/dashboard/reservations', label: 'Réservations',   Icon: IconCalendar        },
  { to: '/dashboard/profil',       label: 'Profil',         Icon: IconUser            },
]

const clientLinks: NavItem[] = [
  { to: '/dashboard',              label: 'Accueil',           Icon: IconHome,    end: true },
  { to: '/dashboard/reservations', label: 'Mes réservations',  Icon: IconCalendar       },
  { to: '/dashboard/favoris',      label: 'Favoris',           Icon: IconHeart          },
  { to: '/dashboard/profil',       label: 'Profil',            Icon: IconUser           },
]

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function IconHome() {
  return <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
}
function IconBuilding() {
  return <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
}
function IconCalendar() {
  return <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function IconHeart() {
  return <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
}
function IconUser() {
  return <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
}
function IconSun() {
  return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path strokeLinecap="round" d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
}
function IconMoon() {
  return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
}
function IconMenu() {
  return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
}
function IconX() {
  return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
}

export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const navLinks = user?.role === 'proprietaire' ? proprietaireLinks : clientLinks
  const handleLogout = () => { logout(); navigate('/login') }

  const roleLabel = user?.role === 'proprietaire' ? 'Propriétaire' : 'Client'

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)', color: 'var(--text-1)' }}>

      {/* ── Desktop Sidebar ── */}
      <aside
        className="hidden lg:flex flex-col sticky top-0 h-screen overflow-hidden shrink-0"
        style={{ width: 240, background: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}
      >
        {/* Logo */}
        <div className="px-5 py-6 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <NavLink
            to="/"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.25rem', fontWeight: 400, color: 'var(--text-1)', letterSpacing: '-0.02em', textDecoration: 'none', flex: 1 }}
          >
            Ma Villa
          </NavLink>
          <span className="text-xs font-semibold uppercase" style={{ color: 'var(--text-3)', letterSpacing: '0.1em', fontSize: '0.6rem' }}>
            {user?.role === 'proprietaire' ? 'Pro' : 'Client'}
          </span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-3 overflow-y-auto scrollbar-none" style={{ paddingRight: '0.5rem' }}>
          {navLinks.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-4 py-5" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, var(--accent), var(--accent-gold))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.65rem', fontWeight: 700, color: '#fff',
            }}>
              {initials(user?.name || '')}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-1)' }}>{user?.name}</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>{roleLabel}</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl transition-colors hover:opacity-70"
              style={{ color: 'var(--text-3)' }}
              title={isDark ? 'Thème clair' : 'Thème sombre'}
            >
              {isDark ? <IconSun /> : <IconMoon />}
            </button>
            <button
              onClick={handleLogout}
              className="text-xs transition-colors hover:opacity-70"
              style={{ color: 'var(--text-3)' }}
            >
              Déconnexion
            </button>
          </div>
        </div>
      </aside>

      {/* ── Content (mobile header + main) ── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Mobile header */}
        <header
          className="lg:hidden px-5 py-4 flex items-center justify-between sticky top-0 z-30 backdrop-blur-md"
          style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)' }}
        >
          <NavLink
            to="/"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.2rem', fontWeight: 400, color: 'var(--text-1)', textDecoration: 'none' }}
          >
            Ma Villa
          </NavLink>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="p-2 rounded-xl" style={{ color: 'var(--text-2)' }}>
              {isDark ? <IconSun /> : <IconMoon />}
            </button>
            <button
              className="p-1.5 rounded-xl transition-colors"
              onClick={() => setOpen(v => !v)}
              aria-label="Menu"
              style={{ color: 'var(--text-1)' }}
            >
              {open ? <IconX /> : <IconMenu />}
            </button>
          </div>
        </header>

        {/* Mobile drawer */}
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setOpen(false)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div
              className="absolute top-0 right-0 h-full w-64 flex flex-col"
              style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
                <span className="text-base font-semibold" style={{ color: 'var(--text-1)' }}>Navigation</span>
                <button onClick={() => setOpen(false)} style={{ color: 'var(--text-2)' }}><IconX /></button>
              </div>
              <nav className="flex-1 flex flex-col px-4 py-4 gap-1">
                {navLinks.map(({ to, label, Icon, end }) => (
                  <NavLink
                    key={to} to={to} end={end}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `px-4 py-3 rounded-xl text-sm font-medium transition-colors flex items-center gap-3 no-underline ${isActive ? 'th-elevated th-text-1' : 'th-text-2'}`
                    }
                    style={{ textDecoration: 'none' }}
                  >
                    <Icon />
                    {label}
                  </NavLink>
                ))}
              </nav>
              <div className="px-4 py-6" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3 mb-4 px-2">
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, var(--accent), var(--accent-gold))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.6rem', fontWeight: 700, color: '#fff',
                  }}>
                    {initials(user?.name || '')}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{user?.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>{roleLabel}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setOpen(false); handleLogout() }}
                  className="w-full px-4 py-3 rounded-xl text-sm text-left transition-colors"
                  style={{ border: '1px solid var(--border)', color: 'var(--text-2)' }}
                >
                  Déconnexion
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 px-5 py-7 lg:px-10 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
