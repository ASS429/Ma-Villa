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

/** `note_moyenne` arrive en chaîne depuis SQL selon le pilote. */
export function noteLisible(note: number | string | null | undefined): string | null {
  const n = typeof note === 'string' ? parseFloat(note) : note
  if (n === null || n === undefined || Number.isNaN(n)) return null
  return n.toFixed(1).replace('.0', '')
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

/** Date du jour au format attendu par `<input type="date">`. */
export function aujourdhui(): string {
  return new Date().toISOString().split('T')[0]
}
