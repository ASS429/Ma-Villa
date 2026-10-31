/**
 * Formes de données renvoyées par l'API.
 * Elles étaient recopiées dans chaque page, avec des champs qui n'existaient
 * pas côté serveur (le prix, notamment) : la carte de villa attendait
 * `prix_min` que l'API ne renvoyait jamais, donc aucun prix ne s'affichait.
 */

export type Role = 'client' | 'proprietaire' | 'admin'

/**
 * `piscine` n'est plus proposé depuis le 28 août 2026, mais reste dans le type :
 * des logements publiés le portent encore, et l'énumération en base ne se
 * réécrit pas sous eux. Voir `TYPES_LOGEMENT_PROPOSES`.
 */
export type TypeLogement =
  | 'villa_entiere' | 'appartement' | 'residence' | 'studio'
  | 'chambre' | 'hotel' | 'auberge'
  /** Retirée du catalogue le 28 août 2026 ; des logements la portent encore. */
  | 'piscine'

export type TypeTarif = 'journee' | 'nuitee' | 'demi_journee' | 'pass'

export type StatutReservation = 'en_attente' | 'confirmee' | 'annulee'

/**
 * `brouillon` : l'annonce existe pour son auteur seul. Ni le public ni la
 * modération ne la voient — c'est ce qui permet de remplir le formulaire en
 * plusieurs fois sans encombrer la file de validation.
 */
export type StatutVilla = 'brouillon' | 'en_attente' | 'validee' | 'rejetee'

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
  /** Longs séjours, sur une nuitée seulement : appliqués dès 7 et 30 nuits (`lib/prix.ts`). */
  prix_semaine?: number | null
  prix_mois?: number | null
}

export interface Logement {
  id: number
  nom: string
  type: TypeLogement
  capacite: number
  /** Le séjour le plus court accepté à la nuitée ; 1 quand le propriétaire n'a rien fixé. */
  nuits_minimum?: number
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
  /**
   * Vrai quand la position est le centre du quartier, posée par PasseTemps
   * faute de mieux (31 octobre 2026) : à ne jamais présenter comme l'adresse.
   */
  position_approximative?: boolean
  /**
   * Ce que le propriétaire précise sous la ville — « Velingara », « derrière
   * RDC ». Le serveur l'extrait de la ville quand elle en contenait trop, pour
   * que « Saly velingara » et « Saly » ne fassent plus deux destinations.
   */
  quartier?: string | null
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
  /** Circuit des associés : le client règle PasseTemps, jamais le propriétaire. */
  encaisse_par_la_plateforme?: boolean
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
  /**
   * La villa est chargée entière sur le détail d'une réservation — d'où
   * l'adresse et le numéro, absents des réponses publiques.
   *
   * ⚠️ `telephone` n'est servi qu'une fois le séjour **engagé** (réservation
   * confirmée ou paiement abouti) : le typer facultatif évite de croire qu'on
   * l'a toujours. Voir `ReservationController::revelerLesCoordonnees()`.
   */
  logement: {
    nom: string
    villa: {
      nom: string
      ville?: string
      adresse?: string
      telephone?: string | null
      latitude?: number | string | null
      longitude?: number | string | null
      /** Circuit des associés : le client règle PasseTemps, jamais le propriétaire. */
      encaisse_par_la_plateforme?: boolean
    }
  }
  tarif: { type_tarif: TypeTarif }
  paiement?: PaiementReservation | null
  /**
   * Un client qui a payé **demande** l'annulation, il ne l'impose plus : la
   * réservation reste confirmée et la date bloquée jusqu'à la décision, faute
   * de quoi il attendrait son argent sans que personne ne le sache.
   */
  annulation_demandee_le?: string | null
  annulation_motif?: string | null
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

/**
 * Les libellés de **tous** les types, y compris ceux qu'on ne propose plus.
 *
 * Un logement déjà publié garde son type : retirer son libellé n'effacerait
 * pas le logement, cela afficherait « undefined » sur sa fiche.
 */
export const LIBELLES_LOGEMENT: Record<TypeLogement, string> = {
  villa_entiere: 'Villa entière',
  appartement: 'Appartement',
  residence: 'Résidence',
  studio: 'Studio',
  chambre: 'Chambre',
  hotel: 'Hôtel',
  auberge: 'Auberge',
  piscine: 'Piscine',
}

/**
 * Ce qu'on propose à la création et au filtrage — la piscine seule en est
 * sortie le 28 août 2026, la résidence y est entrée.
 *
 * Distinct de `LIBELLES_LOGEMENT` à dessein : cesser de proposer un type n'est
 * pas la même chose que cesser de savoir le nommer.
 */
export const TYPES_LOGEMENT_PROPOSES: TypeLogement[] = [
  'villa_entiere',
  'appartement',
  'residence',
  'studio',
  'chambre',
  'hotel',
  'auberge',
]

/** Unité affichée à côté du prix « à partir de ». */
/**
 * Le statut d'une villa s'affichait brut — « Saly · en_attente » sur l'écran
 * de gestion. Une clé de base de données n'est pas un libellé.
 */
export const LIBELLES_STATUT_VILLA: Record<StatutVilla, string> = {
  brouillon: 'Brouillon',
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

/** Une catégorie de la boutique, telle que le serveur la rend — avec son compte. */
export interface CategorieBoutique {
  cle: string
  nom: string
  pluriel: string
  total: number
}

export interface Oeuvre {
  id: number
  titre: string
  artiste: string
  categorie: string
  /** Nombre d'exemplaires restants. 1 pour une pièce unique. */
  stock: number
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
  /** Annulée alors qu'elle était payée : la date où l'acheteur a été remboursé. */
  remboursee_le?: string | null
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

/* ─── Services aux voyageurs — transport et repas ──────────────────
   Le catalogue vient du serveur (`config/prestations.php`), dans les deux
   langues : c'est lui qui valide la prestation demandée et la nomme dans la
   console. Une seconde liste ici finirait par diverger. */

export type Langue = 'fr' | 'en'
export type Traduit = Record<Langue, string>
export type FamillePrestation = 'transport' | 'restauration'

export interface Prestation {
  cle: string
  famille: FamillePrestation
  /** Prix de départ indicatif, en FCFA : rien n'est encaissé dessus. */
  prix_a_partir_de: number
  /** La prestation part de l'aéroport : on demande le numéro du vol. */
  vol: boolean
  libelle: Traduit
  unite: Traduit
  description: Traduit
}

export interface CataloguePrestations {
  /** Les familles visibles par l'appelant — fermées comprises pour l'administration. */
  familles: Partial<Record<FamillePrestation, Traduit>>
  catalogue: Prestation[]
  delai_reponse_heures: number
  /** Celles que seul l'administrateur voit, en aperçu. */
  en_apercu?: FamillePrestation[]
}

/** D'où part une demande : la page d'un service, ou la vitrine des JOJ. */
export type OrigineDemande = FamillePrestation | 'joj'

export type StatutDemandeService = 'nouvelle' | 'traitee' | 'abandonnee'

export interface DemandeService {
  id: number
  reference: string
  prestation: string
  libelle_prestation: string
  date_service: string
  heure: string | null
  personnes: number
  lieu: string
  /** La position donnée par le visiteur (« Utiliser ma position actuelle »), si elle l'a été. */
  latitude: number | null
  longitude: number | null
  precision_m: number | null
  vol: string | null
  delegation: string | null
  nom: string
  telephone: string
  email: string | null
  message: string | null
  langue: Langue
  origine: OrigineDemande | null
  statut: StatutDemandeService
  traitee_le: string | null
  traitee_par?: { id: number; name: string } | null
  created_at: string
}

export const LIBELLES_STATUT_DEMANDE: Record<StatutDemandeService, string> = {
  nouvelle: 'À traiter',
  traitee: 'Traitée',
  abandonnee: 'Abandonnée',
}
