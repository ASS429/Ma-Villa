import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import CoquilleAuth, { AlerteAuth } from '../components/CoquilleAuth'
import Seo from '../components/Seo'
import Button from '../components/ui/Button'
import api from '../services/api'
import { messageErreur } from '../lib/erreurs'

/**
 * Ce qu'on dit selon l'issue.
 *
 * `invalide` couvre en pratique deux choses très différentes : un lien
 * fabriqué, et un lien qui a simplement vieilli. Le second est le cas
 * courant, et de loin — d'où le texte, qui suppose l'expiration plutôt que
 * la fraude.
 */
const MESSAGES = {
  ok: {
    titre: 'Adresse confirmée',
    alerte: 'succes' as const,
    texte: 'Votre adresse est confirmée. Votre compte est prêt.',
  },
  deja: {
    titre: 'Déjà confirmée',
    alerte: 'succes' as const,
    texte: 'Cette adresse était déjà confirmée. Rien de plus à faire.',
  },
  invalide: {
    titre: 'Ce lien a expiré',
    alerte: 'erreur' as const,
    texte: "Les liens de confirmation ne restent valables qu'un temps. Demandez-en un nouveau : il arrivera dans la minute.",
  },
}

export default function EmailVerifie() {
  const [params] = useSearchParams()
  const statut = (params.get('statut') ?? 'invalide') as keyof typeof MESSAGES
  const { titre, alerte, texte } = MESSAGES[statut] ?? MESSAGES.invalide

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
      setErreur(messageErreur(e, "Le lien n'a pas pu être renvoyé."))
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <>
      <Seo titre={titre} description="Confirmation de votre adresse PasseTemps." indexable={false} />

      <CoquilleAuth
        titre={titre}
        pied={
          expire
            ? <Link to="/login" className="th-text-1 font-medium hover:underline underline-offset-4">Se connecter</Link>
            : <Link to="/villas" className="th-text-1 font-medium hover:underline underline-offset-4">Découvrir les villas</Link>
        }
      >
        {/* Un lien expiré occupe l'écran entier avec une sortie, plutôt que
            de s'afficher en rouge sous un formulaire : il n'y a rien à
            corriger, seulement quelque chose à redemander. */}
        <AlerteAuth type={alerte}>{texte}</AlerteAuth>

        {expire ? (
          renvoye ? (
            <AlerteAuth type="succes">
              Un nouveau lien vient de partir. Vérifiez votre boîte, et les indésirables.
            </AlerteAuth>
          ) : (
            <>
              {erreur && <AlerteAuth type="erreur">{erreur}</AlerteAuth>}
              <Button variante="primaire" taille="md" bloc chargement={envoi} onClick={redemander}>
                {envoi ? 'Envoi…' : 'Demander un nouveau lien'}
              </Button>
              <p className="text-xs th-text-3 text-center mt-3">
                Si vous n'êtes pas connecté, connectez-vous d'abord : nous saurons alors
                à quelle adresse l'envoyer.
              </p>
            </>
          )
        ) : (
          <Link
            to="/dashboard"
            className="block w-full text-center py-3 rounded-xl font-semibold transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)', textDecoration: 'none' }}
          >
            Aller à mon espace
          </Link>
        )}
      </CoquilleAuth>
    </>
  )
}
