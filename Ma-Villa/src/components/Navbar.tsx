import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useConfig } from '../context/ConfigContext'
import { useLiensServices } from '../prestations/useLiensServices'
import { cheminSansLangue, useLangue } from '../i18n/langue'
import { COMMUN } from '../i18n/commun'
import ChoixLangue from '../i18n/ChoixLangue'
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

export default function Navbar() {
  const { user, logout } = useAuth()
  const { boutique } = useConfig()
  const services = useLiensServices()
  const { isDark, toggleTheme } = useTheme()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const close = () => setOpen(false)

  const { langue, lien } = useLangue()
  const t = COMMUN[langue].nav
  const isHome = cheminSansLangue(location.pathname) === '/'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Transparent on home hero, solid elsewhere
  const transparent = isHome && !scrolled
  const dashLink = user?.role === 'admin' ? '/admin' : '/dashboard'
  const dashLabel = user?.role === 'admin' ? t.admin : t.monEspace

  // Hors photo, la couleur suit les tokens : les deux branches Tailwind
  // qu'il y avait ici redisaient `--text-2` en la figeant, et ne suivaient
  // donc plus le thème si celui-ci évoluait.
  const navTextClass = `nav-lien${transparent ? ' sur-photo' : ''}`

  return (
    <>
      <div className="px-6 md:px-12 lg:px-16 barre-haute relative z-40">
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
          <Marque taille="md" sombre={transparent} onClick={close} />

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-7">
            <NavLink to={lien('/hebergements/')} className={`text-sm transition-colors ${navTextClass}`}>
              {t.hebergements}
            </NavLink>
            {services.map((l) => (
              <NavLink key={l.cle} to={l.to} className={`text-sm transition-colors ${navTextClass}`}>
                {l.label}
              </NavLink>
            ))}
            {boutique.actif && (
              <NavLink to={lien('/boutique/')} className={`text-sm transition-colors ${navTextClass}`}>
                {t.boutique}
              </NavLink>
            )}
            {user && (
              <NavLink to={dashLink} className={`text-sm transition-colors ${navTextClass}`}>
                {dashLabel}
              </NavLink>
            )}
          </div>

          {/* Desktop right */}
          <div className="hidden md:flex items-center gap-3">
            <ChoixLangue compact style={{ color: transparent ? 'rgba(255,255,255,0.85)' : 'var(--text-2)' }} />
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              // `title` seul ne suffit pas : il ne s'affiche pas au doigt, et
              // certains lecteurs d'écran le rétrogradent derrière tout le reste.
              aria-label={isDark ? t.themeClair : t.themeSombre}
              className="commande-entete transition-all hover:scale-110"
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
                  {t.deconnexion}
                </button>
              </>
            ) : (
              <>
                <Link
                  to={lien('/login')}
                  className="text-sm px-3 py-1.5 transition-colors"
                  style={{ color: transparent ? 'rgba(255,255,255,0.85)' : 'var(--text-2)' }}
                >
                  {t.connexion}
                </Link>
                <Link
                  to={lien('/register')}
                  className="text-sm px-5 py-2 rounded-xl font-medium transition-all hover:scale-[1.03] hover:shadow-md"
                  style={{
                    background: transparent ? '#fff' : 'var(--text-1)',
                    color: transparent ? '#1C1917' : 'var(--bg)',
                  }}
                >
                  {t.inscrire}
                </Link>
              </>
            )}
          </div>

          {/* Mobile: theme toggle + hamburger */}
          <div className="md:hidden flex items-center gap-2">
            <ChoixLangue compact style={{ color: transparent ? 'rgba(255,255,255,0.85)' : 'var(--text-2)' }} />
            <button
              onClick={toggleTheme}
              aria-label={isDark ? t.themeClair : t.themeSombre}
              className="commande-entete transition-colors"
              style={{ color: transparent ? 'rgba(255,255,255,0.8)' : 'var(--text-2)' }}
            >
              {isDark ? <IconSun /> : <IconMoon />}
            </button>
            <button
              className="commande-entete transition-colors"
              style={{ color: transparent ? '#fff' : 'var(--text-1)' }}
              onClick={() => setOpen((v) => !v)}
              aria-label={t.menu}
              aria-expanded={open}
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
              <Marque taille="sm" onClick={close} />
              <button onClick={close} className="th-text-2 hover:th-text-1 transition-colors" aria-label={t.fermerMenu}>
                <IconX />
              </button>
            </div>

            <nav className="flex-1 flex flex-col px-4 py-4 gap-1">
              <MobileLink to={lien('/hebergements/')} onClick={close}>{t.hebergements}</MobileLink>
              {services.map((l) => <MobileLink key={l.cle} to={l.to} onClick={close}>{l.label}</MobileLink>)}
              {boutique.actif && <MobileLink to={lien('/boutique/')} onClick={close}>{t.boutique}</MobileLink>}
              {boutique.actif && user && (
                <MobileLink to={lien('/boutique/commandes')} onClick={close}>{t.mesCommandes}</MobileLink>
              )}
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
                    {t.deconnexion}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <MobileLink to={lien('/login')} onClick={close}>{t.connexion}</MobileLink>
                  <Link
                    to={lien('/register')}
                    onClick={close}
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
