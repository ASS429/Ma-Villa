import { useState } from 'react'
import { Link, useNavigate, Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import CoquilleAuth, { AlerteAuth } from '../components/CoquilleAuth'
import FloatingInput from '../components/FloatingInput'
import Seo from '../components/Seo'
import Button from '../components/ui/Button'
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

export default function Login() {
  const { login, isLoading, user } = useAuth()
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
    <CoquilleAuth
      titre="Connexion"
      sousTitre="Accédez à votre espace Ma Villa"
      pied={
        <>
          Pas encore de compte ?{' '}
          <Link to="/register" className="th-text-1 font-medium hover:underline underline-offset-4">
            S'inscrire
          </Link>
        </>
      }
    >
      <Seo titre="Connexion" description="Connectez-vous à votre espace Ma Villa." chemin="/login" />

      {error && <AlerteAuth type="erreur">{error}</AlerteAuth>}

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
            // Nommé et atteignable au clavier : sans nom, un lecteur d'écran
            // annonce « bouton » sans dire lequel ; exclu de la tabulation, il
            // devient inutilisable sans souris.
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="bouton-icone p-1 transition-colors"
              style={{ color: 'var(--text-3)' }}
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
            className="text-sm th-text-2 hover:th-text-1 underline underline-offset-4"
          >
            Mot de passe oublié ?
          </Link>
        </div>

        <Button type="submit" variante="primaire" taille="md" bloc chargement={isLoading} className="mt-1">
          Se connecter
        </Button>
      </form>
    </CoquilleAuth>
  )
}
