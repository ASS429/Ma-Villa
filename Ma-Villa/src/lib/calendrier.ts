/**
 * Fabrique un événement de calendrier à partir d'un séjour.
 *
 * Pourquoi un fichier plutôt qu'un lien « Ajouter à Google Agenda » : le lien
 * suppose un compte Google connecté dans le navigateur, ce qui n'est pas la
 * norme sur un téléphone où l'agenda est celui du système. Un `.ics` est
 * compris par Google Agenda, l'agenda d'iOS et celui de Samsung sans rien
 * demander à personne.
 */

interface Sejour {
  titre: string
  lieu?: string
  debut: string
  fin: string
  note?: string
}

/** `2026-08-12` → `20260812`. Le format iCalendar ne veut pas des tirets. */
function jour(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, '')
}

/**
 * Une virgule, un point-virgule ou une barre oblique inverse ferment un champ
 * iCalendar : sans échappement, une adresse comme « Route de Ngaparou, Saly »
 * casse le fichier et l'agenda le refuse en bloc.
 */
function echapper(texte: string): string {
  return texte.replace(/([\\,;])/g, '\\$1').replace(/\n/g, '\\n')
}

export function evenementIcal(sejour: Sejour): string {
  // Une date de fin est **exclusive** en iCalendar : sans ce jour de plus,
  // un séjour du 12 au 19 s'afficherait du 12 au 18 dans l'agenda.
  const lendemain = new Date(`${sejour.fin.slice(0, 10)}T00:00:00Z`)
  lendemain.setUTCDate(lendemain.getUTCDate() + 1)

  const lignes = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PasseTemps//FR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@passetemps`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    `DTSTART;VALUE=DATE:${jour(sejour.debut)}`,
    `DTEND;VALUE=DATE:${lendemain.toISOString().slice(0, 10).replace(/-/g, '')}`,
    `SUMMARY:${echapper(sejour.titre)}`,
    sejour.lieu ? `LOCATION:${echapper(sejour.lieu)}` : '',
    sejour.note ? `DESCRIPTION:${echapper(sejour.note)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)

  // CRLF : la norme iCalendar l'exige, et l'agenda d'iOS refuse un fichier
  // qui ne s'y tient pas.
  return lignes.join('\r\n')
}

/** Provoque l'enregistrement du fichier, ou son ouverture par l'agenda. */
export function telechargerIcal(sejour: Sejour, nomFichier = 'sejour.ics') {
  const blob = new Blob([evenementIcal(sejour)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const lien = document.createElement('a')
  lien.href = url
  lien.download = nomFichier
  document.body.appendChild(lien)
  lien.click()
  document.body.removeChild(lien)

  // Sans révocation, le blob reste en mémoire jusqu'à la fermeture de
  // l'onglet. Le délai laisse au navigateur le temps d'ouvrir le fichier.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
