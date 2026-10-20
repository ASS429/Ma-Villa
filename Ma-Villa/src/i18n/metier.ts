import {
  LIBELLES_LOGEMENT, LIBELLES_STATUT_COMMANDE, LIBELLES_TARIF, UNITE_TARIF,
  type Langue, type StatutCommande, type Tarif, type TypeLogement, type TypeTarif,
} from '../types'
import { useLangue } from './langue'

/**
 * Les mots du métier — formules, types de logement, unités de prix,
 * catégories — dans les deux langues des pages client.
 *
 * Le français reste défini dans `types.ts`, où les écrans des propriétaires et
 * de la console le lisent déjà : on ne le recopie pas ici, on le reprend. Seul
 * l'anglais est écrit dans ce fichier.
 */

interface Metier {
  tarif: Record<TypeTarif, string>
  /** « / la nuit », « / night » : l'unité qui suit un prix. */
  unite: Record<TypeTarif, string>
  logement: Record<TypeLogement, string>
  statutCommande: Record<StatutCommande, string>
  /** Une catégorie du catalogue, par sa clé : le serveur n'en sert que le nom français. */
  categorie: Record<string, { nom: string; pluriel: string }>
  personnes: (n: number) => string
  pers: string
  options: (clim: boolean, buffet: boolean) => string
}

const fr: Metier = {
  tarif: LIBELLES_TARIF,
  unite: UNITE_TARIF,
  logement: LIBELLES_LOGEMENT,
  statutCommande: LIBELLES_STATUT_COMMANDE,
  // Vide : en français, le nom servi par le serveur fait foi.
  categorie: {},
  personnes: (n) => `${n} personne${n > 1 ? 's' : ''}`,
  pers: 'pers.',
  options: (clim, buffet) => {
    const o = [clim ? 'clim' : null, buffet ? 'buffet' : null].filter(Boolean)
    return o.length ? `avec ${o.join(' et ')}` : 'sans option'
  },
}

const en: Metier = {
  tarif: { journee: 'Day', nuitee: 'Night', demi_journee: 'Half-day', pass: 'Pass' },
  unite: { journee: 'day', nuitee: 'night', demi_journee: 'half-day', pass: 'pass' },
  logement: {
    villa_entiere: 'Whole villa',
    appartement: 'Apartment',
    residence: 'Residence',
    studio: 'Studio',
    chambre: 'Room',
    hotel: 'Hotel',
    auberge: 'Guesthouse',
    piscine: 'Pool',
  },
  statutCommande: {
    en_attente: 'Pending',
    confirmee: 'Confirmed',
    expediee: 'Shipped',
    livree: 'Delivered',
    annulee: 'Cancelled',
  },
  categorie: {
    villa: { nom: 'Villa', pluriel: 'Villas' },
    appartement: { nom: 'Apartment', pluriel: 'Apartments' },
    residence: { nom: 'Residence', pluriel: 'Residences' },
    studio: { nom: 'Studio', pluriel: 'Studios' },
    chambre: { nom: 'Room', pluriel: 'Rooms' },
    hotel: { nom: 'Hotel', pluriel: 'Hotels' },
    auberge: { nom: 'Guesthouse', pluriel: 'Guesthouses' },
  },
  personnes: (n) => `${n} ${n > 1 ? 'people' : 'person'}`,
  pers: 'ppl',
  options: (clim, buffet) => {
    const o = [clim ? 'air conditioning' : null, buffet ? 'buffet' : null].filter(Boolean)
    return o.length ? `with ${o.join(' and ')}` : 'no extras'
  },
}

export const METIER: Record<Langue, Metier> = { fr, en }

export function useMetier(): Metier {
  return METIER[useLangue().langue]
}

/** Les options d'un tarif, dans la langue voulue. */
export function libelleOptionsEn(t: Tarif, langue: Langue): string {
  return METIER[langue].options(Boolean(t.avec_clim), Boolean(t.avec_buffet))
}

/** Le nom d'une catégorie : le nom anglais connu, sinon celui du serveur. */
export function nomCategorie(
  c: { cle: string; nom: string; nom_pluriel?: string },
  langue: Langue,
  pluriel = false,
): string {
  const traduit = METIER[langue].categorie[c.cle]
  if (traduit) return pluriel ? traduit.pluriel : traduit.nom
  return pluriel ? (c.nom_pluriel ?? c.nom) : c.nom
}
