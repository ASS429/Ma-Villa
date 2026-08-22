/** Formatage partagé — le franc CFA n'a pas de décimales. */

export function fcfa(montant: number | string | null | undefined): string {
  const n = typeof montant === 'string' ? parseFloat(montant) : montant
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return `${Math.round(n).toLocaleString('fr-FR')} FCFA`
}

/** Version compacte pour les badges : 120 000 → « 120 k ». */
export function fcfaCourt(montant: number | string | null | undefined): string {
  const n = typeof montant === 'string' ? parseFloat(montant) : montant
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`
  if (n >= 10_000) return `${Math.round(n / 1000).toLocaleString('fr-FR')} k`
  return Math.round(n).toLocaleString('fr-FR')
}

export function dateCourte(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function dateNumerique(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * `note_moyenne` arrive en chaîne depuis SQL selon le pilote — et PostgreSQL
 * renvoie un numérique à seize décimales. Le séparateur est la virgule :
 * « 4,9 », pas « 4.9 ».
 */
export function noteLisible(note: number | string | null | undefined): string | null {
  const n = typeof note === 'string' ? parseFloat(note) : note
  if (n === null || n === undefined || Number.isNaN(n)) return null
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
}

export function nuits(debut: string, fin: string): number {
  const diff = Math.round(
    (new Date(fin).getTime() - new Date(debut).getTime()) / 86_400_000
  )
  return Math.max(diff, 0)
}

export function libelleDuree(debut: string, fin: string): string {
  const n = nuits(debut, fin)
  if (n === 0) return '1 jour'
  return `${n} nuit${n > 1 ? 's' : ''}`
}

/**
 * Un séjour, en une seule mention de mois et d'année quand c'est possible.
 *
 * « 13 août 2026 – 17 août 2026 » répète deux fois ce qu'on lit une fois, et
 * l'essentiel — les deux quantièmes — se noie dedans. « 13 – 17 août 2026 »
 * se lit d'un coup. Un séjour à cheval sur deux mois garde les deux.
 */
export function periode(debut: string, fin: string): string {
  const d = new Date(debut)
  const f = new Date(fin)

  const memeMois = d.getMonth() === f.getMonth() && d.getFullYear() === f.getFullYear()

  if (memeMois) {
    return `${d.getDate()} – ${dateCourte(fin)}`
  }

  const memeAnnee = d.getFullYear() === f.getFullYear()
  const debutLisible = memeAnnee
    ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    : dateCourte(debut)

  return `${debutLisible} – ${dateCourte(fin)}`
}

/** Date du jour au format attendu par `<input type="date">`. */
export function aujourdhui(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Temps écoulé, en abrégé : « à l'instant », « 3 h », « hier », « 12 mars ».
 *
 * Sur un fil d'activité, la question est « est-ce récent ? », pas « quelle
 * date ? ». Une date complète oblige à la comparer mentalement à aujourd'hui ;
 * au-delà d'une semaine, en revanche, l'écart cesse de parler et c'est la date
 * qui redevient l'information utile.
 */
export function depuis(iso: string): string {
  const secondes = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)

  if (secondes < 60) return "à l'instant"
  if (secondes < 3600) return `${Math.floor(secondes / 60)} min`
  if (secondes < 86_400) return `${Math.floor(secondes / 3600)} h`

  const jours = Math.floor(secondes / 86_400)
  if (jours === 1) return 'hier'
  if (jours < 7) return `${jours} j`

  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
