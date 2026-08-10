import { useEffect } from 'react'

interface SeoProps {
  titre: string
  description: string
  image?: string
  /** Chemin canonique, ex. `/villas/12`. Par défaut : l'URL courante. */
  chemin?: string
  /** `noindex` sur les espaces privés : ils n'ont rien à faire dans Google. */
  indexable?: boolean
  /** Donnée structurée schema.org, sérialisée en JSON-LD. */
  donneesStructurees?: Record<string, unknown>
}

const SITE = 'Ma Villa'
const IMAGE_DEFAUT = '/og-image.jpg'

function baliseMeta(cle: 'name' | 'property', valeur: string, contenu: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${cle}="${valeur}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(cle, valeur)
    document.head.appendChild(el)
  }
  el.setAttribute('content', contenu)
}

/**
 * Renseigne titre et métadonnées de partage à chaque changement de route.
 * Sans ça, un lien de fiche villa envoyé sur WhatsApp — le canal principal
 * sur ce marché — s'affiche en URL nue : ni photo, ni titre, ni prix.
 */
export default function Seo({
  titre,
  description,
  image = IMAGE_DEFAUT,
  chemin,
  indexable = true,
  donneesStructurees,
}: SeoProps) {
  useEffect(() => {
    const titreComplet = titre === SITE ? titre : `${titre} — ${SITE}`
    document.title = titreComplet

    const origine = window.location.origin
    const url = origine + (chemin ?? window.location.pathname)
    const imageAbsolue = image.startsWith('http') ? image : origine + image

    baliseMeta('name', 'description', description)
    baliseMeta('name', 'robots', indexable ? 'index, follow' : 'noindex, nofollow')

    baliseMeta('property', 'og:type', 'website')
    baliseMeta('property', 'og:site_name', SITE)
    baliseMeta('property', 'og:title', titreComplet)
    baliseMeta('property', 'og:description', description)
    baliseMeta('property', 'og:image', imageAbsolue)
    baliseMeta('property', 'og:url', url)
    baliseMeta('property', 'og:locale', 'fr_SN')

    baliseMeta('name', 'twitter:card', 'summary_large_image')
    baliseMeta('name', 'twitter:title', titreComplet)
    baliseMeta('name', 'twitter:description', description)
    baliseMeta('name', 'twitter:image', imageAbsolue)

    let canonique = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonique) {
      canonique = document.createElement('link')
      canonique.rel = 'canonical'
      document.head.appendChild(canonique)
    }
    canonique.href = url
  }, [titre, description, image, chemin, indexable])

  useEffect(() => {
    if (!donneesStructurees) return

    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify(donneesStructurees)
    document.head.appendChild(script)

    return () => { script.remove() }
  }, [donneesStructurees])

  return null
}
