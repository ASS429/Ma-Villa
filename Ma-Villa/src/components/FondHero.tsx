import { useState } from 'react'

/**
 * Décide une fois pour toutes si la vidéo décorative mérite d'être chargée.
 * Sur ce marché la donnée mobile est payée au volume : le mode économiseur
 * et les connexions lentes se contentent de l'image d'affiche.
 */
function videoPertinente(): boolean {
  if (typeof window === 'undefined') return false

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false

  const connexion = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string }
  }).connection

  if (connexion?.saveData) return false
  if (connexion?.effectiveType && ['slow-2g', '2g', '3g'].includes(connexion.effectiveType)) return false

  return true
}

/**
 * Image d'affiche toujours présente, vidéo seulement si le contexte s'y prête.
 * La vidéo précédente venait d'une URL CloudFront tierce héritée d'un gabarit,
 * pesait 5 Mo et tournait sur toutes les pages, y compris le tableau de bord.
 * Ici elle est locale, allégée, et purement décorative.
 */
export default function FondHero() {
  // Évalué au premier rendu : aucun effet, donc aucun second rendu inutile.
  const [videoAutorisee] = useState(videoPertinente)

  return (
    <>
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "image-set(url('/hero-poster.webp') type('image/webp'), url('/hero-poster.jpg') type('image/jpeg'))" }}
        aria-hidden="true"
      />

      {videoAutorisee && (
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src="/hero.mp4"
          poster="/hero-poster.jpg"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
        />
      )}

      {/* Voile de lisibilité pour le texte blanc du hero. */}
      <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
    </>
  )
}
