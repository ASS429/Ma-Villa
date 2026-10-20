import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { messageErreur } from '../lib/erreurs'
import { useLangue } from '../i18n/langue'
import { TEXTES_COMPTES } from '../i18n/comptes'
import CoquilleAuth, { AlerteAuth } from '../components/CoquilleAuth'
import FloatingInput from '../components/FloatingInput'
import Seo from '../components/Seo'

export default function MotDePasseOublie() {
  const [email, setEmail] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [envoye, setEnvoye] = useState(false)
  const [erreur, setErreur] = useState('')
  const { langue, lien } = useLangue()
  const t = TEXTES_COMPTES[langue].oublie

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault()
    setErreur('')
    setEnvoi(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setEnvoye(true)
    } catch (err) {
      setErreur(messageErreur(err, t.echec))
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <>
      <Seo
        titre={t.titre}
        description={t.seoDescription}
        indexable={false}
      />

      <CoquilleAuth
        titre={t.titre}
        sousTitre={envoye ? undefined : t.sousTitre}
        pied={<Link to={lien('/login')} className="th-text-1 font-medium hover:underline underline-offset-4">{t.retour}</Link>}
      >
        {envoye ? (
          <>
            <AlerteAuth type="succes">
              {t.envoyeAvant} <strong>{email}</strong>{t.envoyeApres}
            </AlerteAuth>
            <p className="text-sm th-text-2 leading-relaxed">
              {t.valable}
            </p>
          </>
        ) : (
          <form onSubmit={soumettre} className="flex flex-col gap-5">
            {erreur && <AlerteAuth type="erreur">{erreur}</AlerteAuth>}

            <FloatingInput
              label={t.email}
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
              {envoi ? t.envoi : t.envoyer}
            </button>
          </form>
        )}
      </CoquilleAuth>
    </>
  )
}
