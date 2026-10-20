import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import CoquilleAuth, { AlerteAuth } from '../components/CoquilleAuth'
import Seo from '../components/Seo'
import Button from '../components/ui/Button'
import api from '../services/api'
import { messageErreur } from '../lib/erreurs'
import { useLangue } from '../i18n/langue'
import { TEXTES_COMPTES } from '../i18n/comptes'

/**
 * Ce qu'on dit selon l'issue.
 *
 * `invalide` couvre en pratique deux choses très différentes : un lien
 * fabriqué, et un lien qui a simplement vieilli. Le second est le cas
 * courant, et de loin — d'où le texte, qui suppose l'expiration plutôt que
 * la fraude.
 */
const ALERTES = { ok: 'succes', deja: 'succes', invalide: 'erreur' } as const

export default function EmailVerifie() {
  const [params] = useSearchParams()
  const { langue, lien } = useLangue()
  const t = TEXTES_COMPTES[langue].verifie
  const brut = params.get('statut') ?? 'invalide'
  const statut: keyof typeof ALERTES = brut in ALERTES ? brut as keyof typeof ALERTES : 'invalide'
  const { titre, texte } = t[statut]
  const alerte = ALERTES[statut]

  const [envoi, setEnvoi] = useState(false)
  const [renvoye, setRenvoye] = useState(false)
  const [erreur, setErreur] = useState('')

  const expire = alerte === 'erreur'

  /**
   * L'envoi n'aboutit que pour quelqu'un de connecté — le serveur sait alors
   * à quelle adresse écrire. Un visiteur déconnecté est renvoyé vers la
   * connexion, ce qui est la seule suite possible.
   */
  async function redemander() {
    setEnvoi(true)
    setErreur('')
    try {
      await api.post('/auth/email/resend')
      setRenvoye(true)
    } catch (e) {
      setErreur(messageErreur(e, t.echec))
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <>
      <Seo titre={titre} description={t.seoDescription} indexable={false} />

      <CoquilleAuth
        titre={titre}
        pied={
          expire
            ? <Link to={lien('/login')} className="th-text-1 font-medium hover:underline underline-offset-4">{t.seConnecter}</Link>
            : <Link to={lien('/hebergements/')} className="th-text-1 font-medium hover:underline underline-offset-4">{t.decouvrir}</Link>
        }
      >
        {/* Un lien expiré occupe l'écran entier avec une sortie, plutôt que
            de s'afficher en rouge sous un formulaire : il n'y a rien à
            corriger, seulement quelque chose à redemander. */}
        <AlerteAuth type={alerte}>{texte}</AlerteAuth>

        {expire ? (
          renvoye ? (
            <AlerteAuth type="succes">
              {t.renvoye}
            </AlerteAuth>
          ) : (
            <>
              {erreur && <AlerteAuth type="erreur">{erreur}</AlerteAuth>}
              <Button variante="primaire" taille="md" bloc chargement={envoi} onClick={redemander}>
                {envoi ? t.envoi : t.nouveauLien}
              </Button>
              <p className="text-xs th-text-3 text-center mt-3">
                {t.connectezVous}
              </p>
            </>
          )
        ) : (
          <Link
            to="/dashboard"
            className="block w-full text-center py-3 rounded-xl font-semibold transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)', textDecoration: 'none' }}
          >
            {t.monEspace}
          </Link>
        )}
      </CoquilleAuth>
    </>
  )
}
