import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { messageErreur } from '../lib/erreurs'
import CoquilleAuth, { AlerteAuth } from '../components/CoquilleAuth'
import FloatingInput from '../components/FloatingInput'
import Seo from '../components/Seo'

export default function MotDePasseOublie() {
  const [email, setEmail] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [envoye, setEnvoye] = useState(false)
  const [erreur, setErreur] = useState('')

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault()
    setErreur('')
    setEnvoi(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setEnvoye(true)
    } catch (err) {
      setErreur(messageErreur(err, "L'envoi a échoué. Réessayez dans un instant."))
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <>
      <Seo
        titre="Mot de passe oublié"
        description="Réinitialisez le mot de passe de votre compte PasseTemps."
        indexable={false}
      />

      <CoquilleAuth
        titre="Mot de passe oublié"
        sousTitre={envoye ? undefined : "Par adresse électronique — c'est le seul chemin de récupération."}
        pied={<Link to="/login" className="th-text-1 font-medium hover:underline underline-offset-4">Retour à la connexion</Link>}
      >
        {envoye ? (
          <>
            <AlerteAuth type="succes">
              Si un compte existe avec l'adresse <strong>{email}</strong>, un lien de
              réinitialisation vient d'être envoyé.
            </AlerteAuth>
            <p className="text-sm th-text-2 leading-relaxed">
              Le lien est valable une heure. Pensez à vérifier vos courriers indésirables.
            </p>
          </>
        ) : (
          <form onSubmit={soumettre} className="flex flex-col gap-5">
            {erreur && <AlerteAuth type="erreur">{erreur}</AlerteAuth>}

            <FloatingInput
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />

            {/* Gris tant que l'adresse manque, et `--on-accent` plutôt que
                du blanc en dur : sur l'accent clair du mode jour, le blanc
                tombait sous le seuil de contraste lisible. */}
            <button
              type="submit"
              disabled={envoi || !email.trim()}
              className="py-3 rounded-xl font-semibold transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:translate-y-0 mt-1"
              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
            >
              {envoi ? 'Envoi…' : 'Envoyer le lien'}
            </button>
          </form>
        )}
      </CoquilleAuth>
    </>
  )
}
