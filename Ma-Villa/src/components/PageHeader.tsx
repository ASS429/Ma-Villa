import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import Marque from './Marque'
import { useLiensServices } from '../prestations/useLiensServices'
import { useLangue } from '../i18n/langue'
import { COMMUN } from '../i18n/commun'
import ChoixLangue from '../i18n/ChoixLangue'

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
  const services = useLiensServices()
  const dashLink = user?.role === 'admin' ? '/admin' : '/dashboard'
  const { langue, lien } = useLangue()
  const t = COMMUN[langue].nav
  const dashLabel = user?.role === 'admin' ? t.admin : t.monEspace

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
          <NavLink to={lien('/hebergements/')} className={({ isActive }) =>
            `text-sm transition-colors ${isActive ? 'th-text-1 font-medium' : 'th-text-2 hover:th-text-1'}`
          }>
            {t.hebergements}
          </NavLink>
          {services.map((l) => (
            <NavLink key={l.cle} to={l.to} className={({ isActive }) =>
              `text-sm transition-colors ${isActive ? 'th-text-1 font-medium' : 'th-text-2 hover:th-text-1'}`
            }>
              {l.label}
            </NavLink>
          ))}
          {user && (
            <NavLink to={dashLink} className={({ isActive }) =>
              `text-sm transition-colors ${isActive ? 'th-text-1 font-medium' : 'th-text-2 hover:th-text-1'}`
            }>
              {dashLabel}
            </NavLink>
          )}
        </nav>

        <div className="hidden md:flex items-center gap-4">
          <ChoixLangue compact className="commande-entete text-xs font-semibold th-text-2 hover:th-text-1" />
          <button
            onClick={toggleTheme}
            aria-label={isDark ? t.themeClair : t.themeSombre}
            className="commande-entete th-text-2 hover:th-text-1 transition-all hover:scale-110"
          >
            {isDark ? <IconSun /> : <IconMoon />}
          </button>
          {user ? (
            <>
              <span className="text-sm th-text-2">{user.name}</span>
              <button onClick={logout} className="text-sm th-text-3 hover:th-text-1 transition-colors">
                {t.deconnexion}
              </button>
            </>
          ) : (
            <>
              <Link to={lien('/login')} className="text-sm th-text-2 hover:th-text-1 transition-colors">{t.connexion}</Link>
              <Link
                to={lien('/register')}
                className="px-4 py-1.5 rounded-xl text-sm font-medium transition-all hover:scale-[1.03]"
                style={{ background: 'var(--text-1)', color: 'var(--bg)' }}
              >
                {t.inscrire}
              </Link>
            </>
          )}
        </div>

        <div className="md:hidden flex items-center gap-2">
          <ChoixLangue compact className="commande-entete text-xs font-semibold th-text-2" />
          <button onClick={toggleTheme} aria-label={isDark ? t.themeClair : t.themeSombre} className="commande-entete th-text-2">
            {isDark ? <IconSun /> : <IconMoon />}
          </button>
          <button
            className="commande-entete th-text-1 transition-colors hover:th-elevated"
            onClick={() => setOpen((v) => !v)}
            aria-label={t.menu}
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
              <button onClick={() => setOpen(false)} className="th-text-2 hover:th-text-1 transition-colors" aria-label={t.fermerMenu}>
                <IconX />
              </button>
            </div>
            <nav className="flex-1 flex flex-col px-4 py-4 gap-1">
              <NavLink
                to={lien('/hebergements/')}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `px-4 py-3 rounded-xl text-sm font-medium transition-colors ${isActive ? 'th-elevated th-text-1' : 'th-text-2 hover:th-elevated'}`
                }
              >
                {t.hebergements}
              </NavLink>
              {services.map((l) => (
                <NavLink
                  key={l.cle}
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `px-4 py-3 rounded-xl text-sm font-medium transition-colors ${isActive ? 'th-elevated th-text-1' : 'th-text-2 hover:th-elevated'}`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
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
                    {t.deconnexion}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <Link
                    to={lien('/login')}
                    onClick={() => setOpen(false)}
                    className="w-full px-4 py-3 rounded-xl text-sm text-center th-text-1 transition-colors"
                    style={{ border: '1px solid var(--border)' }}
                  >
                    {t.connexion}
                  </Link>
                  <Link
                    to={lien('/register')}
                    onClick={() => setOpen(false)}
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium text-center transition-colors"
                    style={{ background: 'var(--text-1)', color: 'var(--bg)' }}
                  >
                    {t.inscrire}
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
