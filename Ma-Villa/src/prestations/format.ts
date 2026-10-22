import type { Langue } from '../types'

export interface Position {
  lat: number
  lng: number
  /** La précision annoncée par le téléphone, en mètres. */
  precision: number | null
}

/**
 * Le lien qui ouvre le point dans Google Maps, sur téléphone comme sur
 * ordinateur : c'est ce qu'un chauffeur touche dans WhatsApp pour s'y rendre.
 */
export function lienCarte(p: Pick<Position, 'lat' | 'lng'>): string {
  return `https://www.google.com/maps/search/?api=1&query=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`
}

/** « lun. 2 nov. » ou « Mon 2 Nov » : la date d'un service, telle qu'on la dit au téléphone. */
export function dateDuService(iso: string, langue: Langue): string {
  // Midi : une date nue lue à minuit UTC peut reculer d'un jour selon le fuseau.
  return new Date(`${iso}T12:00:00`).toLocaleDateString(langue === 'en' ? 'en-GB' : 'fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}
