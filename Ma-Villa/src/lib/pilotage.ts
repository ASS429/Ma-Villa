import type { Feuille, FormatColonne } from './tableur'
import type { LigneTemps } from '../components/console/Graphiques'

/** La réponse de `/admin/pilotage`. */
export type FormatIndicateur = 'nombre' | 'fcfa' | 'pourcent' | 'heures'
export type GroupeIndicateur = 'activite' | 'resultat' | 'qualite' | 'aujourdhui'

export interface Indicateur {
  groupe: GroupeIndicateur
  cle: string
  libelle: string
  format: FormatIndicateur
  sens: 'haut' | 'bas' | 'neutre'
  valeur: number | null
  precedent: number | null
  aide: string | null
}

export interface LigneHebergement {
  id: number
  nom: string
  ville: string
  quartier: string | null
  proprietaire: string | null
  statut: string
  demandes: number
  refus?: number
  devis: number
  particulieres: number
  reservations: number
  confirmees: number
  montant_devis: number
  encaisse: number
  note: number | null
  avis: number
  photos: number
  prix_min: number | null
  derniere_demande: string | null
  defauts: string[]
}

export interface LigneVille {
  ville: string
  annonces: number
  demandes: number
  refus?: number
  demandes_par_annonce: number | null
  montant_devis: number
  reservations: number
  encaisse: number
}

export interface Manquement {
  gravite: 'haute' | 'moyenne' | 'basse'
  titre: string
  detail: string
  conseil: string
  lien: string | null
}

export type Repartition = { nom: string; valeur: number }[]

export interface Pilotage {
  periode: { du: string; au: string; jours: number; avant_du: string; avant_au: string }
  genere_le: string
  indicateurs: Indicateur[]
  series: { pas: 'jour' | 'semaine' | 'mois'; lignes: LigneTemps[] }
  entonnoir: { cle: string; libelle: string; valeur: number }[]
  repartitions: { prestations: Repartition; types: Repartition; statuts_devis: Repartition; origines_devis: Repartition; langues: Repartition; refus?: Repartition; moyens?: Repartition }
  moments: { jours: string[]; creneaux: string[]; grille: number[][] }
  hebergements: LigneHebergement[]
  villes: LigneVille[]
  manquements: Manquement[]
  atouts: string[]
}

export const LIBELLES_GROUPE: Record<GroupeIndicateur, string> = {
  activite: 'Ce que nous faisons',
  resultat: 'Ce que nous réalisons',
  qualite: 'La qualité de notre service',
  aujourdhui: 'Où nous en sommes aujourd’hui',
}

export const LIBELLES_GRAVITE: Record<Manquement['gravite'], string> = {
  haute: 'Urgent',
  moyenne: 'À traiter',
  basse: 'À surveiller',
}

const dateFr = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '')

/** Ce qu'a changé un chiffre, en proportion ; en points pour un taux, déjà une proportion. */
export function evolution(i: Pick<Indicateur, 'valeur' | 'precedent' | 'format'>): number | null {
  if (i.valeur === null || i.precedent === null) return null
  if (i.format === 'pourcent') return i.valeur - i.precedent
  if (i.precedent === 0) return null
  return (i.valeur - i.precedent) / i.precedent
}

/**
 * Les feuilles du classeur exporté. Elles se construisent sur la réponse même de
 * l'écran : le fichier dit donc exactement ce qu'on a sous les yeux.
 *
 * Couleurs des graphiques : les jetons `--serie-1` à `--serie-4` du thème clair,
 * validés pour le daltonisme.
 */
export function feuillesDuPilotage(p: Pilotage): Feuille[] {
  const note = `Du ${dateFr(p.periode.du)} au ${dateFr(p.periode.au)}, comparé au ${dateFr(p.periode.avant_du)} – ${dateFr(p.periode.avant_au)}. Essais exclus. Aucune mesure des visites.`

  const indicateurs = p.indicateurs
  const lignesTemps = p.series.lignes
  const nombre = (v: unknown) => Number(v ?? 0)
  const somme = (cle: string) => lignesTemps.reduce((t, l) => t + nombre(l[cle]), 0)

  const parPeriode: Feuille = {
    nom: 'Par période',
    titre: `Activité par ${p.series.pas}`,
    note,
    colonnes: [
      { titre: p.series.pas === 'jour' ? 'Jour' : p.series.pas === 'semaine' ? 'Semaine du' : 'Mois', largeur: 12 },
      { titre: 'Devis en ligne', format: 'nombre', largeur: 11 },
      { titre: 'Demandes particulières', format: 'nombre', largeur: 13 },
      { titre: 'Demandes de service', format: 'nombre', largeur: 11 },
      { titre: 'Réservations', format: 'nombre', largeur: 13 },
      { titre: 'Comptes créés', format: 'nombre', largeur: 10 },
      { titre: 'Montant des devis', format: 'fcfa', largeur: 17 },
      { titre: 'Encaissé', format: 'fcfa', largeur: 17 },
      { titre: 'Devis refusés', format: 'nombre', largeur: 10 },
    ],
    lignes: lignesTemps.map((l) => [
      String(l.libelle), nombre(l.devis), nombre(l.particulieres), nombre(l.services), nombre(l.reservations),
      nombre(l.comptes), nombre(l.devis_montant), nombre(l.encaisse), nombre(l.refus),
    ]),
    total: ['Total', somme('devis'), somme('particulieres'), somme('services'), somme('reservations'), somme('comptes'), somme('devis_montant'), somme('encaisse'), somme('refus')],
  }

  const hebergements: Feuille = {
    nom: 'Hébergements',
    titre: 'Hébergements',
    note,
    colonnes: [
      { titre: 'Hébergement', largeur: 38 }, { titre: 'Ville', largeur: 14 }, { titre: 'Propriétaire', largeur: 22 },
      { titre: 'Statut', largeur: 11 },
      { titre: 'Demandes', format: 'nombre', barres: true, largeur: 11 },
      { titre: 'Devis', format: 'nombre', largeur: 8 },
      { titre: 'Demandes particulières', format: 'nombre', largeur: 13 },
      { titre: 'Réservations', format: 'nombre', largeur: 13 },
      { titre: 'Confirmées', format: 'nombre', largeur: 11 },
      { titre: 'Devis refusés', format: 'nombre', largeur: 10 },
      { titre: 'Montant des devis', format: 'fcfa', barres: true, largeur: 17 },
      { titre: 'Encaissé', format: 'fcfa', largeur: 17 },
      { titre: 'Note', format: 'decimal', largeur: 7 },
      { titre: 'Avis', format: 'nombre', largeur: 7 },
      { titre: 'Photos', format: 'nombre', largeur: 8 },
      { titre: 'Prix à partir de', format: 'fcfa', largeur: 15 },
      { titre: 'Dernière demande', largeur: 12 },
      { titre: 'À revoir', largeur: 34 },
    ],
    lignes: p.hebergements.map((h) => [
      h.nom, h.ville, h.proprietaire, h.statut === 'validee' ? 'En ligne' : h.statut, h.demandes, h.devis, h.particulieres,
      h.reservations, h.confirmees, h.refus ?? 0, h.montant_devis, h.encaisse, h.note, h.avis, h.photos, h.prix_min,
      dateFr(h.derniere_demande), h.defauts.join(', '),
    ]),
  }

  const villes: Feuille = {
    nom: 'Villes',
    titre: 'La demande et l’offre par ville',
    note,
    colonnes: [
      { titre: 'Ville', largeur: 18 },
      { titre: 'Annonces en ligne', format: 'nombre', largeur: 11 },
      { titre: 'Demandes', format: 'nombre', barres: true, largeur: 11 },
      { titre: 'Devis refusés', format: 'nombre', largeur: 10 },
      { titre: 'Demandes par annonce', format: 'decimal', largeur: 12 },
      { titre: 'Montant des devis', format: 'fcfa', largeur: 17 },
      { titre: 'Réservations', format: 'nombre', largeur: 13 },
      { titre: 'Encaissé', format: 'fcfa', largeur: 17 },
    ],
    lignes: p.villes.map((v) => [v.ville, v.annonces, v.demandes, v.refus ?? 0, v.demandes_par_annonce, v.montant_devis, v.reservations, v.encaisse]),
  }

  const manquements: Feuille = {
    nom: 'Manquements',
    titre: 'Nos manquements, et ce qu’on propose',
    note,
    colonnes: [
      { titre: 'Priorité', largeur: 12 }, { titre: 'Constat', largeur: 46 },
      { titre: 'Détail', largeur: 60 }, { titre: 'Ce qu’on propose', largeur: 60 },
    ],
    lignes: p.manquements.map((m) => [LIBELLES_GRAVITE[m.gravite], m.titre, m.detail, m.conseil]),
  }

  const r = p.repartitions
  const repartitions: Feuille = {
    nom: 'Répartitions',
    titre: 'Répartitions',
    note,
    colonnes: [{ titre: 'Sujet', largeur: 26 }, { titre: 'Catégorie', largeur: 38 }, { titre: 'Nombre', format: 'nombre', barres: true, largeur: 10 }],
    lignes: ([
      ['Demandes de service', r.prestations], ['Demandes particulières', r.types], ['Devis par statut', r.statuts_devis],
      ['Devis par origine', r.origines_devis], ['Langue des demandes', r.langues], ['Devis refusés', r.refus ?? []],
      ['Encaissé par moyen (FCFA)', r.moyens ?? []],
    ] as [string, Repartition][]).flatMap(([sujet, lignes]) => lignes.map((l) => [sujet, l.nom, l.valeur])),
  }

  const moments: Feuille = {
    nom: 'Moments',
    titre: 'Quand les demandes arrivent',
    note,
    colonnes: [{ titre: 'Jour', largeur: 12 }, ...p.moments.creneaux.map((c) => ({ titre: c, format: 'nombre' as const, largeur: 11 }))],
    lignes: p.moments.jours.map((j, i) => [j, ...p.moments.grille[i]]),
    chaleur: true,
  }

  const formats: Record<FormatIndicateur, FormatColonne> = { nombre: 'nombre', fcfa: 'fcfa', pourcent: 'pourcent', heures: 'heures' }

  const tableau: Feuille = {
    nom: 'Tableau de bord',
    titre: 'PasseTemps — tableau de pilotage',
    note,
    colonnes: [
      { titre: 'Rubrique', largeur: 28 }, { titre: 'Indicateur', largeur: 30 },
      { titre: 'Valeur', format: 'nombre', largeur: 17 }, { titre: 'Période précédente', format: 'nombre', largeur: 17 },
      { titre: 'Évolution', format: 'evolution', largeur: 11 },
    ],
    lignes: indicateurs.map((i) => [LIBELLES_GROUPE[i.groupe], i.libelle, i.valeur, i.precedent, evolution(i)]),
    formatDe: (ligne, colonne) => (colonne === 2 || colonne === 3 ? formats[indicateurs[ligne].format] : undefined),
    graphiques: [
      {
        type: 'colonnes', empile: true, titre: 'Demandes reçues', feuille: parPeriode.nom, categories: 0,
        series: [
          { colonne: 1, couleur: 'C4622D' }, { colonne: 2, couleur: '1F7FA3' },
          { colonne: 3, couleur: 'B8860B' }, { colonne: 4, couleur: '7A5BC7' },
        ],
        place: { colonne: 6, ligne: 3, largeur: 9, hauteur: 16 },
      },
      {
        type: 'ligne', titre: 'Montant des devis et encaissé (FCFA)', feuille: parPeriode.nom, categories: 0,
        series: [{ colonne: 6, couleur: 'C4622D' }, { colonne: 7, couleur: '1F7FA3' }],
        place: { colonne: 6, ligne: 20, largeur: 9, hauteur: 16 },
      },
      {
        type: 'barres', titre: 'Annonces les plus demandées', feuille: hebergements.nom, categories: 0, lignes: 10,
        series: [{ colonne: 4, couleur: 'C4622D' }],
        place: { colonne: 6, ligne: 37, largeur: 9, hauteur: 18 },
      },
    ],
  }

  return [tableau, parPeriode, hebergements, villes, manquements, repartitions, moments]
}
