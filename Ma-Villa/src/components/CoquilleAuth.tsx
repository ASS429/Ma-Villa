import { Link } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'

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

/**
 * Cadre commun aux écrans d'authentification, pour éviter d'en recopier
 * la structure dans chaque nouvelle page du parcours.
 */
export default function CoquilleAuth({
  titre,
  sousTitre,
  children,
  pied,
}: {
  titre: string
  sousTitre?: string
  children: React.ReactNode
  pied?: React.ReactNode
}) {
  const { isDark, toggleTheme } = useTheme()

  return (
    <div
      className="coquille-auth min-h-screen flex items-center justify-center px-4 py-12 relative"
      style={{ background: 'var(--bg)', color: 'var(--text-1)' }}
    >
      {!isDark && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 70% 30%, rgba(196,98,45,0.06) 0%, transparent 60%), radial-gradient(ellipse at 30% 80%, rgba(168,197,216,0.12) 0%, transparent 60%)',
          }}
        />
      )}

      <button
        onClick={toggleTheme}
        className="bouton-icone absolute top-6 right-6 p-2.5 rounded-xl transition-all hover:scale-110"
        style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-2)' }}
        aria-label={isDark ? 'Passer au thème clair' : 'Passer au thème sombre'}
      >
        {isDark ? <IconSun /> : <IconMoon />}
      </button>

      <div className="w-full max-w-md relative z-10">
        <Link to="/" className="flex justify-center mb-10" aria-label="Retour à l'accueil Ma Villa">
          <img src="/logo.webp" alt="Ma Villa" width={80} height={80} className="h-20 w-20 rounded-2xl object-contain" />
        </Link>

        <div
          className="rounded-2xl p-8"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
        >
          <h1 className="text-2xl font-semibold mb-1 th-text-1">{titre}</h1>
          {sousTitre && <p className="text-sm mb-8 th-text-2">{sousTitre}</p>}
          {children}
        </div>

        {pied && <div className="text-center text-sm mt-6 th-text-2">{pied}</div>}
      </div>
    </div>
  )
}

export function AlerteAuth({ type, children }: { type: 'erreur' | 'succes'; children: React.ReactNode }) {
  const erreur = type === 'erreur'
  return (
    <div
      className="rounded-xl px-4 py-3 text-sm mb-6 flex items-start gap-2"
      style={{
        background: erreur ? 'rgba(220,38,38,0.08)' : 'rgba(34,135,90,0.08)',
        border: `1px solid ${erreur ? 'rgba(220,38,38,0.22)' : 'rgba(34,135,90,0.22)'}`,
        color: erreur ? 'var(--danger)' : 'var(--success)',
      }}
      role={erreur ? 'alert' : 'status'}
    >
      <span aria-hidden="true">{erreur ? '⚠' : '✓'}</span>
      <span className="flex-1">{children}</span>
    </div>
  )
}
