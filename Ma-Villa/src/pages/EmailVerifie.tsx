import { Link, useSearchParams } from 'react-router-dom'
import CoquilleAuth, { AlerteAuth } from '../components/CoquilleAuth'
import Seo from '../components/Seo'

const MESSAGES = {
  ok: {
    titre: 'Adresse confirmée',
    alerte: 'succes' as const,
    texte: 'Votre adresse email est confirmée. Votre compte est prêt.',
  },
  deja: {
    titre: 'Déjà confirmée',
    alerte: 'succes' as const,
    texte: 'Cette adresse était déjà confirmée. Rien de plus à faire.',
  },
  invalide: {
    titre: 'Lien invalide',
    alerte: 'erreur' as const,
    texte: "Ce lien de confirmation est invalide ou a expiré. Vous pouvez en demander un nouveau depuis votre profil.",
  },
}

export default function EmailVerifie() {
  const [params] = useSearchParams()
  const statut = (params.get('statut') ?? 'invalide') as keyof typeof MESSAGES
  const { titre, alerte, texte } = MESSAGES[statut] ?? MESSAGES.invalide

  return (
    <>
      <Seo titre={titre} description="Confirmation de votre adresse email Ma Villa." indexable={false} />

      <CoquilleAuth
        titre={titre}
        pied={<Link to="/villas" className="th-text-1 font-medium hover:underline underline-offset-4">Découvrir les villas</Link>}
      >
        <AlerteAuth type={alerte}>{texte}</AlerteAuth>

        <Link
          to="/dashboard"
          className="block w-full text-center py-3 rounded-xl font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--accent)', textDecoration: 'none' }}
        >
          Aller à mon espace
        </Link>
      </CoquilleAuth>
    </>
  )
}
