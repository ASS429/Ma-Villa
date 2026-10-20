import type { Langue } from '../types'

/** « lun. 2 nov. » ou « Mon 2 Nov » : la date d'un service, telle qu'on la dit au téléphone. */
export function dateDuService(iso: string, langue: Langue): string {
  // Midi : une date nue lue à minuit UTC peut reculer d'un jour selon le fuseau.
  return new Date(`${iso}T12:00:00`).toLocaleDateString(langue === 'en' ? 'en-GB' : 'fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}
