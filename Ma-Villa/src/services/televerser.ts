import { URL_API } from './api'
import { poidsLisible, reduireImage } from '../lib/image'

/**
 * Envoie un fichier au serveur et renvoie son URL publique.
 *
 * Passe par `fetch` plutôt que par l'instance axios : celle-ci impose
 * `Content-Type: application/json` à toutes ses requêtes, alors qu'un envoi
 * multipart exige que le navigateur pose lui-même l'en-tête, avec la frontière
 * qui sépare les parties. Imposer le type sans frontière rend le corps
 * illisible pour le serveur.
 *
 * Cette fonction existait en double, dans la création et dans la modification
 * de villa, avec l'adresse de l'API recopiée en dur sur `localhost`. Le
 * téléversement de photos ne pouvait donc pas fonctionner ailleurs qu'en
 * développement — c'est-à-dire nulle part où un propriétaire publie vraiment.
 */
export async function televerserFichier(fichier: File): Promise<string> {
  // Réduite avant l'envoi si elle dépasse le seuil. Sur un forfait payé au
  // volume, envoyer huit mégaoctets pour se les faire refuser coûte de
  // l'argent à celui qui publie — et bloquait dix-sept annonces.
  const aEnvoyer = await reduireImage(fichier)

  const corps = new FormData()
  corps.append('file', aEnvoyer)

  let reponse: Response
  try {
    reponse = await fetch(`${URL_API}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
        Accept: 'application/json',
      },
      body: corps,
    })
  } catch {
    throw new Error('Le serveur est injoignable. Réessayez dans un instant.')
  }

  if (reponse.ok) {
    const donnees = await reponse.json()
    return donnees.url
  }

  // Les deux refus qu'un propriétaire rencontre réellement méritent un message
  // qui dit quoi faire, pas un « échec » sans suite.
  // La cause en deux mots, avec le poids : « Trop lourde · 8,4 Mo » se
  // comprend et se répare, « échec » ne se répare pas.
  if (reponse.status === 413) {
    throw new Error(`Trop lourde · ${poidsLisible(aEnvoyer.size)} — même après réduction.`)
  }
  if (reponse.status === 422) {
    const donnees = await reponse.json().catch(() => ({}))
    throw new Error(
      donnees?.errors?.file?.[0]
      ?? donnees?.message
      ?? 'Ce format de fichier n\'est pas accepté.'
    )
  }
  if (reponse.status === 401) {
    throw new Error('Votre session a expiré. Reconnectez-vous.')
  }

  throw new Error(`L'envoi de « ${fichier.name} » a échoué.`)
}
