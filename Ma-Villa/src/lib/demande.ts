import { dateCourte, fcfa, nuits } from './format'
import { METIER, libelleOptionsEn } from '../i18n/metier'
import type { Langue, Reservation, Tarif } from '../types'

/**
 * Ce qu'on sait d'une demande au moment d'écrire sur WhatsApp, déjà mis en forme.
 * Un détail absent disparaît du message : le visiteur n'a parfois choisi que
 * l'hébergement, et le contact doit tout de même savoir de quoi on lui parle.
 */
export interface DetailsDemande {
  reference?: string
  hebergement?: string
  ville?: string
  logement?: string
  formule?: string
  prix?: string
  arrivee?: string
  depart?: string
  duree?: string
  personnes?: number
  total?: string
  lien?: string
}

/** Ce qu'il faut d'une réservation pour écrire le message, quel que soit l'écran. */
export type ReservationDemandee =
  Pick<Reservation, 'id' | 'date_debut' | 'date_fin' | 'nb_personnes' | 'montant_total' | 'tarif'>
  & { logement: { nom: string; villa: { id?: number; nom: string; ville?: string } } }

/** Barre oblique finale obligatoire : sans elle, Render sert le gabarit générique. */
export function lienDeLaFiche(id: number): string {
  return `${window.location.origin}/hebergements/${id}/`
}

/** « Nuitée, avec clim » : les options ne se disent que s'il y en a. */
export function formuleDe(tarif: Reservation['tarif'], langue: Langue): string {
  const nom = METIER[langue].tarif[tarif.type_tarif]
  return tarif.avec_clim || tarif.avec_buffet
    ? `${nom}, ${libelleOptionsEn(tarif as Tarif, langue)}`
    : nom
}

/** « 45 000 FCFA / la nuit ». */
export function prixDe(tarif: Tarif, langue: Langue): string {
  return `${fcfa(tarif.prix)} / ${METIER[langue].unite[tarif.type_tarif]}`
}

/** Une réservation existe déjà : tout est connu, le message porte tout. */
export function detailsDeLaReservation(r: ReservationDemandee, langue: Langue): DetailsDemande {
  const { villa } = r.logement
  const n = nuits(r.date_debut, r.date_fin)
  return {
    reference: `#${r.id}`,
    hebergement: villa.nom,
    ville: villa.ville,
    logement: r.logement.nom,
    formule: formuleDe(r.tarif, langue),
    arrivee: dateCourte(r.date_debut, langue),
    depart: dateCourte(r.date_fin, langue),
    duree: r.tarif.type_tarif === 'nuitee' && n > 0 ? METIER[langue].duree(n) : undefined,
    personnes: r.nb_personnes,
    total: fcfa(r.montant_total),
    lien: villa.id ? lienDeLaFiche(villa.id) : undefined,
  }
}
