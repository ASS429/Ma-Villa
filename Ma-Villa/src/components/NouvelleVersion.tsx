import { useEffect, useState } from 'react'

/** Toutes les cinq minutes, plus à chaque retour sur l'onglet. */
const INTERVALLE = 5 * 60 * 1000

/**
 * Le script principal chargé par la page en cours. Son nom porte une empreinte
 * du contenu : il change à chaque publication.
 */
function scriptCharge(): string | null {
  return document
    .querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]')
    ?.getAttribute('src') ?? null
}

/** Celui que le serveur sert à l'instant. */
async function scriptPublie(): Promise<string | null> {
  const reponse = await fetch('/index.html', { cache: 'no-store' })
  if (!reponse.ok) return null

  return reponse.text().then(
    (html) => html.match(/["'](\/?assets\/index-[A-Za-z0-9_-]+\.js)["']/)?.[1] ?? null
  )
}

/**
 * Signale qu'une version plus récente est en ligne.
 *
 * Une application monopage ne recharge jamais son `index.html` : un onglet
 * resté ouvert continue d'exécuter le code d'avant, indéfiniment. On corrige
 * un défaut, on publie, et l'utilisateur le revoit à l'identique — le vrai
 * problème devient alors de comprendre pourquoi le correctif « ne marche pas ».
 *
 * Rien n'est rechargé d'autorité : le faire pendant une saisie ou un paiement
 * ferait perdre le travail en cours. On propose, l'utilisateur choisit.
 */
export default function NouvelleVersion() {
  const [disponible, setDisponible] = useState(false)

  useEffect(() => {
    const charge = scriptCharge()
    if (!charge) return

    // Comparer les noms de fichier seuls : le serveur peut servir un chemin
    // absolu là où la page portait un chemin relatif, ou l'inverse.
    const nom = (chemin: string) => chemin.split('/').pop()
    let vivant = true

    const verifier = () => {
      scriptPublie()
        .then((publie) => {
          if (!vivant || !publie) return
          if (nom(publie) !== nom(charge)) setDisponible(true)
        })
        .catch(() => { /* hors ligne ou serveur muet : on retentera */ })
    }

    const minuteur = setInterval(verifier, INTERVALLE)
    const auRetour = () => { if (document.visibilityState === 'visible') verifier() }
    document.addEventListener('visibilitychange', auRetour)

    return () => {
      vivant = false
      clearInterval(minuteur)
      document.removeEventListener('visibilitychange', auRetour)
    }
  }, [])

  if (!disponible) return null

  return (
    <div className="bandeau-version" role="status">
      <span>Une version plus récente de Ma Villa est disponible.</span>
      <button type="button" onClick={() => window.location.reload()}>
        Recharger
      </button>
    </div>
  )
}
