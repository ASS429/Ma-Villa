import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { erreursParChamp, messageErreur } from '../lib/erreurs'
import { useLangue } from '../i18n/langue'
import { TEXTES_COMPTES } from '../i18n/comptes'
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
  const [erreursChamp, setErreursChamp] = useState<Record<string, string>>({})
  // Un lien mort n'est pas une erreur de saisie : il n'y a rien à corriger
  // dans le formulaire, seulement un nouveau lien à demander. On remplace
  // donc l'écran plutôt que d'afficher un bandeau rouge au-dessus de champs
  // devenus inutiles.
  const [lienMort, setLienMort] = useState(false)
  const [fait, setFait] = useState(false)
  const { langue, lien } = useLangue()
  const t = TEXTES_COMPTES[langue].reinitialiser

  const lienIncomplet = !token || !email

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault()
    setErreur('')
    setErreursChamp({})

    if (form.password !== form.password_confirmation) {
      setErreursChamp({ password_confirmation: t.differents })
      return
    }

    setEnvoi(true)
    try {
      await api.post('/auth/reset-password', { token, email, ...form })
      setFait(true)
      setTimeout(() => navigate(lien('/login')), 2500)
    } catch (err) {
      const champs = erreursParChamp(err)

      // Laravel range l'échec du jeton sous `email` : c'est le lien qui est
      // en cause, pas l'adresse, et le dire ainsi enverrait corriger un
      // champ que l'écran n'affiche même pas.
      if (champs.email || champs.token) {
        setLienMort(true)
      } else if (Object.keys(champs).length > 0) {
        setErreursChamp(champs)
      } else {
        setErreur(messageErreur(err, t.echec))
      }
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <>
      <Seo titre={t.titre} description={t.seoDescription} indexable={false} />

      <CoquilleAuth
        titre={t.titre}
        sousTitre={lienIncomplet || fait ? undefined : t.pourLeCompte(email)}
        pied={<Link to={lien('/login')} className="th-text-1 font-medium hover:underline underline-offset-4">{t.retour}</Link>}
      >
        {lienIncomplet || lienMort ? (
          <>
            <AlerteAuth type="erreur">
              {lienIncomplet
                ? t.incomplet
                : t.expire}
            </AlerteAuth>

            <Link
              to={lien('/mot-de-passe-oublie')}
              className="block w-full text-center py-3 rounded-xl font-semibold transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent)', color: 'var(--on-accent)', textDecoration: 'none' }}
            >
              {t.nouveauLien}
            </Link>
          </>
        ) : fait ? (
          <AlerteAuth type="succes">
            {t.fait}
          </AlerteAuth>
        ) : (
          <form onSubmit={soumettre} className="flex flex-col gap-5">
            {erreur && <AlerteAuth type="erreur">{erreur}</AlerteAuth>}

            <FloatingInput
              label={t.nouveau}
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="new-password"
              error={erreursChamp.password}
            />
            <FloatingInput
              label={t.confirmer}
              type="password"
              required
              minLength={8}
              value={form.password_confirmation}
              onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })}
              autoComplete="new-password"
              error={erreursChamp.password_confirmation}
            />

            <p className="text-xs th-text-3 -mt-2">{t.minimum}</p>

            {/* `text-white` ne suivait pas le thème : sur l'accent clair du
                mode jour, le contraste tombait sous le seuil lisible. */}
            <button
              type="submit"
              disabled={envoi || form.password.length < 8 || !form.password_confirmation}
              className="py-3 rounded-xl font-semibold transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:translate-y-0"
              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
            >
              {envoi ? t.enregistrement : t.changer}
            </button>
          </form>
        )}
      </CoquilleAuth>
    </>
  )
}
