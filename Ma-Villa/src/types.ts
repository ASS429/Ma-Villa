/**
 * Formes de données renvoyées par l'API.
 * Elles étaient recopiées dans chaque page, avec des champs qui n'existaient
 * pas côté serveur (le prix, notamment) : la carte de villa attendait
 * `prix_min` que l'API ne renvoyait jamais, donc aucun prix ne s'affichait.
 */

export type Role = 'client' | 'proprietaire' | 'admin'

export type TypeLogement = 'villa_entiere' | 'appartement' | 'chambre' | 'piscine'

export type TypeTarif = 'journee' | 'nuitee' | 'demi_journee' | 'pass'

export type StatutReservation = 'en_attente' | 'confirmee' | 'annulee'

export type StatutVilla = 'en_attente' | 'validee' | 'rejetee'

export interface User {
  id: number
  name: string
  email: string
  role: Role
  phone: string | null
  avatar: string | null
  email_verified_at?: string | null
}

export interface Photo {
  url: string
  alt: string
}

export interface Tarif {
  id: number
  type_tarif: TypeTarif
  avec_clim: boolean
  avec_buffet: boolean
  prix: number
}

export interface Logement {
  id: number
  nom: string
  type: TypeLogement
  capacite: number
  disponible: boolean
  tarifs: Tarif[]
}

export interface Avis {
  id: number
  note: number
  commentaire: string
  client: { name: string }
  created_at: string
}

/** Champs communs à la liste et à la fiche. */
interface VillaBase {
  id: number
  nom: string
  ville: string
  description: string
  /**
   * Absent des réponses publiques : le numéro n'est servi qu'au propriétaire
   * de la villa et à l'administrateur. Le typer facultatif évite de croire
   * qu'on l'a toujours — et de l'afficher sur un écran qui ne l'aura jamais.
   */
  telephone?: string
  photos: Photo[]
  vedette?: boolean
  statut?: StatutVilla
  /** Coordonnées GPS — chaînes en PostgreSQL, nombres ailleurs. */
  latitude?: number | string | null
  longitude?: number | string | null
  /**
   * Agrégats calculés côté serveur — absents si la villa n'a ni tarif ni avis.
   * PostgreSQL renvoie les numériques en chaîne : `fcfa()` et `noteLisible()`
   * acceptent les deux formes.
   */
  prix_min?: number | string | null
  /** Type du tarif le moins cher, pour afficher la bonne unité à côté du prix. */
  prix_min_unite?: TypeTarif | null
  /** Déduits des logements et des formules : 1 ou null selon le moteur SQL. */
  a_piscine?: number | boolean | null
  a_climatisation?: number | boolean | null
  note_moyenne?: number | string | null
  avis_count?: number
  capacite_max?: number | null
}

/** Villa telle que renvoyée par la liste `/villas`. */
export type VillaResume = VillaBase

/** Villa telle que renvoyée par la fiche `/villas/{id}`. */
export interface VillaDetail extends VillaBase {
  adresse: string
  latitude: number | null
  longitude: number | null
  logements: Logement[]
  avis: Avis[]
  proprietaire: { name: string }
}

/**
 * Paiement rattaché à une réservation, tel que l'API le renvoie. Le jeton du
 * prestataire n'en fait jamais partie : il permettrait d'agir sur la facture.
 */
export interface PaiementReservation {
  statut: 'en_attente' | 'reussi' | 'echoue'
  methode?: string | null
  reference: string | null
  montant?: number | null
  paye_le: string | null
  /** Présentes sur le détail d'une réservation, pas sur la liste. */
  url_paiement?: string | null
  /** Lien qui ouvre directement Wave ou Orange Money, sur téléphone. */
  url_application?: string | null
}

export interface Reservation {
  id: number
  date_debut: string
  date_fin: string
  nb_personnes: number
  montant_total: number
  statut: StatutReservation
  client?: { name: string; email: string; phone?: string | null }
  logement: { nom: string; villa: { nom: string } }
  tarif: { type_tarif: TypeTarif }
  paiement?: PaiementReservation | null
}

/** Plages déjà occupées, par identifiant de logement. */
export type Occupation = Record<string, { date_debut: string; date_fin: string }[]>

export interface PageResult<T> {
  data: T[]
  current_page: number
  last_page: number
  total: number
  per_page: number
}

export const LIBELLES_TARIF: Record<TypeTarif, string> = {
  journee: 'Journée',
  nuitee: 'Nuitée',
  demi_journee: 'Demi-journée',
  pass: 'Pass',
}

export const LIBELLES_LOGEMENT: Record<TypeLogement, string> = {
  villa_entiere: 'Villa entière',
  appartement: 'Appartement',
  chambre: 'Chambre',
  piscine: 'Piscine',
}

/** Unité affichée à côté du prix « à partir de ». */
/**
 * Le statut d'une villa s'affichait brut — « Saly · en_attente » sur l'écran
 * de gestion. Une clé de base de données n'est pas un libellé.
 */
export const LIBELLES_STATUT_VILLA: Record<StatutVilla, string> = {
  en_attente: 'En attente de validation',
  validee: 'Publiée',
  rejetee: 'Rejetée',
}

export const UNITE_TARIF: Record<TypeTarif, string> = {
  journee: 'la journée',
  nuitee: 'la nuit',
  demi_journee: 'la demi-journée',
  pass: 'le pass',
}

/* ════════════════════════════════════════════════════════════════
   BOUTIQUE D'ŒUVRES
   ════════════════════════════════════════════════════════════════ */

/** `vendue` reste visible : une galerie qui efface ses ventes perd sa preuve de vendre. */
export type StatutOeuvre = 'brouillon' | 'publiee' | 'vendue'

export interface Oeuvre {
  id: number
  titre: string
  artiste: string
  description: string | null
  technique: string | null
  dimensions: string | null
  annee: number | null
  prix: number
  statut: StatutOeuvre
  vedette: boolean
  photos: Photo[]
  /** Présent seulement sur l'écran d'administration. */
  commandes_actives?: number
  created_at?: string
}

export type StatutCommande = 'en_attente' | 'confirmee' | 'expediee' | 'livree' | 'annulee'
export type ModePaiementCommande = 'en_ligne' | 'livraison'

export interface Commande {
  id: number
  oeuvre_id: number
  /** Recopiés à la commande : un changement de prix ne réécrit pas une vente passée. */
  oeuvre_titre: string
  oeuvre_artiste: string
  montant_oeuvre: number
  zone_livraison: string
  frais_livraison: number
  montant_total: number
  destinataire: string
  telephone: string
  adresse: string
  ville: string
  note: string | null
  mode_paiement: ModePaiementCommande
  statut_paiement: 'en_attente' | 'reussi' | 'echoue'
  statut: StatutCommande
  reference: string | null
  url_paiement: string | null
  url_application: string | null
  paye_le: string | null
  expediee_le: string | null
  livree_le: string | null
  created_at: string
  oeuvre?: Oeuvre
  client?: { id: number; name: string; email: string }
}

export const LIBELLES_STATUT_COMMANDE: Record<StatutCommande, string> = {
  en_attente: 'En attente',
  confirmee: 'Confirmée',
  expediee: 'Expédiée',
  livree: 'Livrée',
  annulee: 'Annulée',
}

export const LIBELLES_STATUT_OEUVRE: Record<StatutOeuvre, string> = {
  brouillon: 'Brouillon',
  publiee: 'En vente',
  vendue: 'Vendue',
}
