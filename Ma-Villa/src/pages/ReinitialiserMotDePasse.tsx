import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { messageErreur } from '../lib/erreurs'
import CoquilleAuth, { AlerteAuth } from '../components/CoquilleAuth'
import FloatingInput from '../components/FloatingInput'
import Seo from '../components/Seo'

export default function ReinitialiserMotDePasse() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''
  const email = params.get('email') ?? ''

  const [form, setForm] = useState({ password: '', password_confirmation: '' })
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState('')
  const [fait, setFait] = useState(false)

  const lienIncomplet = !token || !email

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault()
    setErreur('')

    if (form.password !== form.password_confirmation) {
      setErreur('Les deux mots de passe ne correspondent pas.')
      return
    }

    setEnvoi(true)
    try {
      await api.post('/auth/reset-password', { token, email, ...form })
      setFait(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      setErreur(messageErreur(err, 'Ce lien est invalide ou expiré.'))
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <>
      <Seo titre="Nouveau mot de passe" description="Choisissez un nouveau mot de passe." indexable={false} />

      <CoquilleAuth
        titre="Nouveau mot de passe"
        sousTitre={lienIncomplet || fait ? undefined : `Pour le compte ${email}`}
        pied={<Link to="/login" className="th-text-1 font-medium hover:underline underline-offset-4">Retour à la connexion</Link>}
      >
        {lienIncomplet ? (
          <AlerteAuth type="erreur">
            Ce lien est incomplet. Refaites une demande depuis la page « Mot de passe oublié ».
          </AlerteAuth>
        ) : fait ? (
          <AlerteAuth type="succes">
            Mot de passe modifié. Redirection vers la connexion…
          </AlerteAuth>
        ) : (
          <form onSubmit={soumettre} className="flex flex-col gap-5">
            {erreur && <AlerteAuth type="erreur">{erreur}</AlerteAuth>}

            <FloatingInput
              label="Nouveau mot de passe"
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="new-password"
            />
            <FloatingInput
              label="Confirmer le mot de passe"
              type="password"
              required
              minLength={8}
              value={form.password_confirmation}
              onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })}
              autoComplete="new-password"
            />

            <p className="text-xs th-text-3 -mt-2">8 caractères minimum.</p>

            <button
              type="submit"
              disabled={envoi}
              className="py-3 rounded-xl font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:translate-y-0"
              style={{ background: 'var(--accent)' }}
            >
              {envoi ? 'Enregistrement…' : 'Changer mon mot de passe'}
            </button>
          </form>
        )}
      </CoquilleAuth>
    </>
  )
}
