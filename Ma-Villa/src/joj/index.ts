/**
 * La vitrine des JOJ Dakar 2026 — **temporaire**.
 *
 * Tout ce qui porte « JOJ » vit dans ce dossier, et seulement ici : après les
 * Jeux, l'exploitant le retire de la plateforme (décision du 20 octobre 2026).
 * Le retrait se fait en deux temps — `JOJ_ACTIF=false` sur Railway, puis la
 * suppression de ce dossier et de ses trois points d'attache — décrits dans
 * `docs/16-RETRAIT-JOJ.md`.
 *
 * Les services qu'elle met en avant (transport, repas) vivent dans
 * `src/prestations/` et lui survivent.
 *
 * ⚠️ PasseTemps n'est ni partenaire ni fournisseur officiel des Jeux : ni les
 * anneaux ni le logo de Dakar 2026 ne figurent ici, et la page le dit.
 */

export const CHEMIN_JOJ = '/joj-dakar-2026/'

/** La variable Railway qui ouvre la vitrine, citée dans l'aperçu. */
export const VARIABLE_JOJ = 'JOJ_ACTIF'

/** Lendemain du dernier jour des Jeux : le bandeau de l'accueil se retire seul. */
const FIN_DES_JEUX = new Date('2026-11-14T00:00:00Z')

export function jeuxEnCours(maintenant = new Date()): boolean {
  return maintenant < FIN_DES_JEUX
}

export interface Site {
  cle: 'dakar' | 'diamniadio' | 'saly'
  nom: string
  /** La ville sous laquelle le serveur range les annonces, ou rien. */
  ville: string | null
}

export const SITES: Site[] = [
  { cle: 'dakar', nom: 'Dakar', ville: 'Dakar' },
  { cle: 'diamniadio', nom: 'Diamniadio', ville: null },
  { cle: 'saly', nom: 'Saly', ville: 'Saly' },
]
