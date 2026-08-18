import { useState } from 'react'
import { Link, useNavigate, Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import FloatingInput from '../components/FloatingInput'
import Seo from '../components/Seo'
import { messageErreur } from '../lib/erreurs'

function IconEye({ show }: { show: boolean }) {
  return show ? (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
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

export default function Login() {
  const { login, isLoading, user } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Après une session expirée, on ramène l'utilisateur là où il était.
  const retour = params.get('retour')

  const destination = (role: string) =>
    retour && retour.startsWith('/') ? retour : role === 'admin' ? '/admin' : '/dashboard'

  if (user) return <Navigate to={destination(user.role)} replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const { user } = await login(form.email, form.password)
      navigate(destination(user.role))
    } catch (err) {
      setError(messageErreur(err, 'Email ou mot de passe incorrect.'))
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative"
      style={{ background: 'var(--bg)', color: 'var(--text-1)' }}
    >
      <Seo
        titre="Connexion"
        description="Connectez-vous à votre espace Ma Villa."
        chemin="/login"
      />
      {/* Background decoration */}
      {!isDark && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 70% 30%, rgba(196,98,45,0.06) 0%, transparent 60%), radial-gradient(ellipse at 30% 80%, rgba(168,197,216,0.12) 0%, transparent 60%)',
          }}
        />
      )}

      {/* Theme toggle */}
      <button
        type="button"
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
          className="rounded-2xl p-8 transition-all"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <h1 className="text-2xl font-semibold mb-1 th-text-1">Connexion</h1>
          <p className="text-sm mb-8 th-text-2">Accédez à votre espace Ma Villa</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl px-4 py-3 text-sm mb-6 flex items-center gap-2">
              <span>⚠</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <FloatingInput
              label="Email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="email"
            />

            <FloatingInput
              label="Mot de passe"
              type={showPassword ? 'text' : 'password'}
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="current-password"
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="bouton-icone p-1 transition-colors"
                  style={{ color: 'var(--text-3)' }}
                  // Nommé et atteignable au clavier : sans nom, un lecteur
                  // d'écran annonce « bouton » sans dire lequel ; exclu de la
                  // tabulation, il devient inutilisable sans souris.
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  aria-pressed={showPassword}
                >
                  <IconEye show={showPassword} />
                </button>
              }
            />

            <div className="-mt-2 text-right">
              <Link
                to="/mot-de-passe-oublie"
                className="text-sm th-text-2 hover:th-text-1 transition-colors underline underline-offset-4"
              >
                Mot de passe oublié ?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="py-3 rounded-xl font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:translate-y-0 mt-1 btn-shimmer"
              style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-warm) 100%)' }}
            >
              {isLoading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <p className="text-center text-sm mt-6 th-text-2">
            Pas encore de compte ?{' '}
            <Link to="/register" className="th-text-1 font-medium hover:underline underline-offset-4 transition-colors">
              S'inscrire
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
