import { useState } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import CoquilleAuth, { AlerteAuth } from '../components/CoquilleAuth'
import FloatingInput from '../components/FloatingInput'
import Seo from '../components/Seo'
import Button from '../components/ui/Button'
import { erreursParChamp, messageErreur } from '../lib/erreurs'

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

export default function Register() {
  const { register, isLoading, user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', password_confirmation: '',
    role: 'client' as 'client' | 'proprietaire',
  })
  const [error, setError] = useState('')
  const [erreursChamp, setErreursChamp] = useState<Record<string, string>>({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  if (user) return <Navigate to="/dashboard" replace />

  const passwordMatch = !form.password_confirmation || form.password === form.password_confirmation

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.password_confirmation) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    setErreursChamp({})
    try {
      await register(form)
      navigate('/dashboard')
    } catch (err) {
      // « Un compte existe déjà avec cette adresse » doit s'afficher sous
      // l'adresse, pas en tête du formulaire : sinon on relit cinq champs
      // pour trouver celui qui pose problème.
      const champs = erreursParChamp(err)
      if (Object.keys(champs).length > 0) setErreursChamp(champs)
      else setError(messageErreur(err))
    }
  }

  return (
    <CoquilleAuth
      titre="Créer un compte"
      sousTitre="Rejoignez Ma Villa dès aujourd'hui"
      pied={
        <>
          Déjà un compte ?{' '}
          <Link to="/login" className="th-text-1 font-medium hover:underline underline-offset-4">
            Se connecter
          </Link>
        </>
      }
    >
      <Seo
        titre="Créer un compte"
        description="Créez votre compte Ma Villa pour réserver un logement ou publier votre villa."
        chemin="/register"
      />

      {error && <AlerteAuth type="erreur">{error}</AlerteAuth>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <FloatingInput
          label="Nom complet"
          type="text"
          required
          value={form.name}
          autoComplete="name"
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />

        <FloatingInput
          label="Email"
          type="email"
          required
          value={form.email}
          autoComplete="email"
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          error={erreursChamp.email}
        />

        {/* Facultatif, et dit comme tel : c'est un écran de péage, chaque
            champ obligatoire de plus coûte une inscription. Mais c'est lui
            qui ouvre la connexion par numéro — beaucoup de propriétaires ont
            une adresse électronique qu'ils ne consultent jamais, et se
            reconnectent bien plus facilement par leur téléphone. */}
        <FloatingInput
          label="Téléphone (facultatif)"
          type="tel"
          inputMode="tel"
          value={form.phone}
          autoComplete="tel"
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          error={erreursChamp.phone}
        />
        <p className="text-xs -mt-3" style={{ color: 'var(--text-3)' }}>
          Il vous permettra de vous connecter sans retenir votre adresse.
        </p>

        {/* Le rôle décide de tout l'espace personnel qui suivra : un groupe de
            boutons radio, et non une liste déroulante qu'on ouvre sans voir
            les deux options. */}
        <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
          <legend
            className="text-xs uppercase tracking-widest font-semibold mb-2"
            style={{ color: 'var(--text-3)' }}
          >
            Je suis
          </legend>
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Type de compte">
            {(['client', 'proprietaire'] as const).map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={form.role === r}
                onClick={() => setForm({ ...form, role: r })}
                className={`pastille-choix${form.role === r ? ' est-choisi' : ''}`}
              >
                {r === 'client' ? 'Client' : 'Propriétaire'}
              </button>
            ))}
          </div>
        </fieldset>

        <FloatingInput
          label="Mot de passe"
          type={showPassword ? 'text' : 'password'}
          required
          minLength={8}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          autoComplete="new-password"
          rightElement={
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

        <FloatingInput
          label="Confirmer le mot de passe"
          type={showConfirm ? 'text' : 'password'}
          required
          value={form.password_confirmation}
          onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })}
          autoComplete="new-password"
          error={!passwordMatch && form.password_confirmation ? 'Les mots de passe ne correspondent pas.' : undefined}
          rightElement={
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="bouton-icone p-1 transition-colors"
              style={{ color: 'var(--text-3)' }}
              aria-label={showConfirm ? 'Masquer la confirmation' : 'Afficher la confirmation'}
              aria-pressed={showConfirm}
            >
              <IconEye show={showConfirm} />
            </button>
          }
        />

        <Button
          type="submit"
          variante="primaire"
          taille="md"
          bloc
          disabled={
            !passwordMatch
            || !form.name.trim()
            || !form.email.trim()
            || form.password.length < 8
          }
          chargement={isLoading}
          className="mt-1"
        >
          {isLoading ? 'Création…' : 'Créer mon compte'}
        </Button>
      </form>
    </CoquilleAuth>
  )
}
