import type { ReactNode } from 'react'
import IconeReseau from './IconeReseau'

/**
 * Le bouton qui ouvre WhatsApp : son vert et son logo, reconnaissables d'un coup
 * d'œil. C'est le contact que PasseTemps met en avant depuis le 2 novembre 2026.
 *
 * Réservé aux liens qui ouvrent vraiment WhatsApp : ce vert annonce où l'on va.
 */
export default function BoutonWhatsApp({
  href,
  children,
  taille = 'md',
  className = '',
}: {
  href: string
  children: ReactNode
  taille?: 'sm' | 'md'
  className?: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`btn btn-whatsapp btn-${taille} ${className}`.trim()}
    >
      <IconeReseau icone="whatsapp" taille={taille === 'md' ? 20 : 18} />
      <span>{children}</span>
    </a>
  )
}
