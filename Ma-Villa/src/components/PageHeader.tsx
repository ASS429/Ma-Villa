import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import Marque from './Marque'

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

export default function PageHeader() {
  const { user, logout } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const dashLink = user?.role === 'admin' ? '/admin' : '/dashboard'
  const dashLabel = user?.role === 'admin' ? 'Admin' : 'Mon espace'

  return (
    <>
      <header
        className="px-6 pb-4 entete-collant flex items-center justify-between sticky z-30 backdrop-blur-md transition-colors"
        style={{
          background: 'var(--header-bg)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <Marque taille="md" />

        <nav className="hidden md:flex items-center gap-6">
          <NavLink to="/hebergements" className={({ isActive }) =>
            `text-sm transition-colors ${isActive ? 'th-text-1 font-medium' : 'th-text-2 hover:th-text-1'}`
          }>
            Hébergements
          </NavLink>
          {user && (
            <NavLink to={dashLink} className={({ isActive }) =>
              `text-sm transition-colors ${isActive ? 'th-text-1 font-medium' : 'th-text-2 hover:th-text-1'}`
            }>
              {dashLabel}
            </NavLink>
          )}
        </nav>

        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={toggleTheme}
            aria-label={isDark ? 'Passer au thème clair' : 'Passer au thème sombre'}
            className="commande-entete th-text-2 hover:th-text-1 transition-all hover:scale-110"
          >
            {isDark ? <IconSun /> : <IconMoon />}
          </button>
          {user ? (
            <>
              <span className="text-sm th-text-2">{user.name}</span>
              <button onClick={logout} className="text-sm th-text-3 hover:th-text-1 transition-colors">
                Déconnexion
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm th-text-2 hover:th-text-1 transition-colors">Connexion</Link>
              <Link
                to="/register"
                className="px-4 py-1.5 rounded-xl text-sm font-medium transition-all hover:scale-[1.03]"
                style={{ background: 'var(--text-1)', color: 'var(--bg)' }}
              >
                S'inscrire
              </Link>
            </>
          )}
        </div>

        <div className="md:hidden flex items-center gap-2">
          <button onClick={toggleTheme} aria-label={isDark ? 'Passer au thème clair' : 'Passer au thème sombre'} className="commande-entete th-text-2">
            {isDark ? <IconSun /> : <IconMoon />}
          </button>
          <button
            className="commande-entete th-text-1 transition-colors hover:th-elevated"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={open}
          >
            {open ? <IconX /> : <IconMenu />}
          </button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="absolute top-0 right-0 h-full w-72 flex flex-col"
            style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
              <Marque taille="sm" onClick={() => setOpen(false)} />
              <button onClick={() => setOpen(false)} className="th-text-2 hover:th-text-1 transition-colors">
                <IconX />
              </button>
            </div>
            <nav className="flex-1 flex flex-col px-4 py-4 gap-1">
              <NavLink
                to="/hebergements"
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `px-4 py-3 rounded-xl text-sm font-medium transition-colors ${isActive ? 'th-elevated th-text-1' : 'th-text-2 hover:th-elevated'}`
                }
              >
                Hébergements
              </NavLink>
              {user && (
                <NavLink
                  to={dashLink}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `px-4 py-3 rounded-xl text-sm font-medium transition-colors ${isActive ? 'th-elevated th-text-1' : 'th-text-2 hover:th-elevated'}`
                  }
                >
                  {dashLabel}
                </NavLink>
              )}
            </nav>
            <div className="px-4 py-6" style={{ borderTop: '1px solid var(--border)' }}>
              {user ? (
                <div className="flex flex-col gap-3">
                  <p className="text-xs th-text-3 px-2">{user.name}</p>
                  <button
                    onClick={() => { logout(); setOpen(false) }}
                    className="w-full px-4 py-3 rounded-xl text-sm text-left th-text-2 transition-colors"
                    style={{ border: '1px solid var(--border)' }}
                  >
                    Déconnexion
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <Link
                    to="/login"
                    onClick={() => setOpen(false)}
                    className="w-full px-4 py-3 rounded-xl text-sm text-center th-text-1 transition-colors"
                    style={{ border: '1px solid var(--border)' }}
                  >
                    Connexion
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setOpen(false)}
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
