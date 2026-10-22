import type { FamillePrestation } from '../types'

/**
 * Les textes des services aux voyageurs — transport et repas — en deux langues.
 *
 * Ces services sont permanents : rien ici ne parle des JOJ. La vitrine des Jeux
 * (`src/joj/`) les met en avant, et se retire sans les toucher.
 *
 * `en` est typé sur `fr` : une clé oubliée dans une langue ne compile pas.
 */

interface PageFamille {
  eyebrow: string
  titre: string
  intro: string
  conseil: string
  seo: { titre: string; description: string }
}

const fr = {
  aPartirDe: 'à partir de',
  demander: 'Demander',
  reessayer: 'Réessayer',
  erreurServices: 'Impossible de charger les services.',

  commentCaMarche: 'Comment ça marche',
  etapes: (h: number) => [
    'Choisissez un service et dites-nous la date.',
    `Nous vous confirmons le prestataire et le prix sur WhatsApp, sous ${h} heures en journée.`,
    'Rien n’est payé en ligne : le règlement vous est indiqué à la confirmation.',
  ],

  formulaire: 'Votre demande',
  formulaireSous: (h: number) => `Rien n’est payé en ligne. Nous vous confirmons le prestataire et le prix sur WhatsApp, sous ${h} heures en journée.`,
  champs: {
    prestation: 'Service',
    date: 'Date',
    heure: 'Heure (facultatif)',
    heureVol: 'Heure d’atterrissage',
    personnes: 'Nombre de personnes',
    vol: 'Numéro de vol',
    lieu: 'Où vous trouver',
    lieuAide: 'Le nom du logement ou une adresse.',
    positionBouton: 'Utiliser ma position actuelle',
    positionEnCours: 'Localisation…',
    positionAjoutee: (m: number | null) => `Position ajoutée${m ? `, à ${m} m près` : ''}.`,
    positionImprecise: 'Position approximative : précisez aussi l’adresse.',
    positionVoir: 'Voir sur la carte',
    positionRetirer: 'Retirer',
    positionRefusee: 'La localisation est refusée. Autorisez-la dans votre navigateur, ou écrivez l’adresse.',
    positionIntrouvable: 'Position introuvable pour l’instant. Écrivez l’adresse, ou réessayez dans un instant.',
    maPosition: 'Ma position actuelle',
    delegation: 'Pays d’origine (facultatif)',
    nom: 'Votre nom',
    telephone: 'Téléphone WhatsApp',
    telephoneAide: 'Avec l’indicatif du pays, par exemple +221 77 123 45 67.',
    email: 'E-mail (facultatif)',
    message: 'Précisions (facultatif)',
    messageAide: 'Un régime alimentaire, un siège enfant, votre programme…',
  },
  choisirService: 'Choisissez un service',
  requis: 'Ce champ est requis.',
  telephoneCourt: 'Ce numéro est trop court.',
  envoyer: 'Envoyer ma demande',

  derniereEtape: 'Dernière étape : envoyez-la sur WhatsApp',
  derniereEtapeTexte: (ref: string | null, nom: string) =>
    `${ref ? `Votre demande ${ref} est enregistrée. ` : ''}Envoyez le message préparé à ${nom}, qui vous répond et confirme le prix.`,
  envoyerWhatsApp: 'Envoyer sur WhatsApp',
  ouAppeler: (tel: string) => `ou appelez le ${tel}`,
  nouvelleDemande: 'Faire une autre demande',
  nonEnregistree: 'Le serveur n’a pas répondu, mais votre demande part quand même par WhatsApp.',

  message: {
    // La typographie française met une espace avant les deux-points, l'anglaise non.
    separateur: ' : ',
    entete: 'Bonjour, voici ma demande PasseTemps',
    reference: 'Référence',
    service: 'Service',
    date: 'Date',
    vol: 'Vol',
    personnes: 'Personnes',
    lieu: 'Lieu',
    position: 'Position',
    delegation: 'Pays d’origine',
    nom: 'Nom',
    telephone: 'Téléphone',
    precisions: 'Précisions',
  },

  familles: {
    transport: {
      eyebrow: 'Transport',
      titre: 'Un chauffeur, de l’aéroport jusqu’à votre logement',
      intro: 'Transfert depuis l’aéroport AIBD, trajets au quotidien, voiture avec chauffeur à la journée : dites-nous ce dont vous avez besoin.',
      conseil: 'Le TER relie Dakar, Diamniadio et l’aéroport AIBD. Pour Saly, la Somone ou Thiès, prévoyez une voiture.',
      seo: {
        titre: 'Transport au Sénégal : transfert aéroport AIBD et chauffeur',
        description: 'Transfert depuis l’aéroport AIBD, trajets quotidiens et voiture avec chauffeur à Dakar, Saly et sur la Petite Côte. Prix confirmé sur WhatsApp.',
      },
    },
    restauration: {
      eyebrow: 'Repas',
      titre: 'Des repas qui vous conviennent, là où vous êtes',
      intro: 'Petit-déjeuner au logement, panier repas à emporter, table dans un restaurant partenaire — halal, végétarien ou sans allergènes sur demande.',
      conseil: 'Dites-nous vos régimes et vos horaires dans les précisions : nous les transmettons au restaurant.',
      seo: {
        titre: 'Repas au Sénégal : petit-déjeuner, panier repas et restaurants',
        description: 'Petit-déjeuner servi au logement, panier repas et tables dans des restaurants partenaires à Dakar et sur la Petite Côte. Prix confirmé sur WhatsApp.',
      },
    },
  } satisfies Record<FamillePrestation, PageFamille>,

  autreService: 'Voir aussi',
}

const en: typeof fr = {
  aPartirDe: 'from',
  demander: 'Request',
  reessayer: 'Try again',
  erreurServices: 'Services could not be loaded.',

  commentCaMarche: 'How it works',
  etapes: (h: number) => [
    'Choose a service and tell us the date.',
    `We confirm the provider and the price on WhatsApp, within ${h} hours during the day.`,
    'Nothing is paid online: you are told how to pay when we confirm.',
  ],

  formulaire: 'Your request',
  formulaireSous: (h: number) => `Nothing is paid online. We confirm the provider and the price on WhatsApp, within ${h} hours during the day.`,
  champs: {
    prestation: 'Service',
    date: 'Date',
    heure: 'Time (optional)',
    heureVol: 'Landing time',
    personnes: 'Number of people',
    vol: 'Flight number',
    lieu: 'Where to find you',
    lieuAide: 'The name of your accommodation or an address.',
    positionBouton: 'Use my current location',
    positionEnCours: 'Locating…',
    positionAjoutee: (m: number | null) => `Location added${m ? `, accurate to ${m} m` : ''}.`,
    positionImprecise: 'Approximate location: please add the address too.',
    positionVoir: 'See on the map',
    positionRetirer: 'Remove',
    positionRefusee: 'Location access was denied. Allow it in your browser, or type the address.',
    positionIntrouvable: 'Your location could not be found right now. Type the address, or try again in a moment.',
    maPosition: 'My current location',
    delegation: 'Country of origin (optional)',
    nom: 'Your name',
    telephone: 'WhatsApp number',
    telephoneAide: 'With the country code, e.g. +44 7700 900123.',
    email: 'Email (optional)',
    message: 'Details (optional)',
    messageAide: 'A diet, a child seat, your schedule…',
  },
  choisirService: 'Choose a service',
  requis: 'This field is required.',
  telephoneCourt: 'This number is too short.',
  envoyer: 'Send my request',

  derniereEtape: 'Last step: send it on WhatsApp',
  derniereEtapeTexte: (ref: string | null, nom: string) =>
    `${ref ? `Your request ${ref} is saved. ` : ''}Send the prepared message to ${nom}, who replies and confirms the price.`,
  envoyerWhatsApp: 'Send on WhatsApp',
  ouAppeler: (tel: string) => `or call ${tel}`,
  nouvelleDemande: 'Make another request',
  nonEnregistree: 'Our server did not answer, but your request still goes through WhatsApp.',

  message: {
    separateur: ': ',
    entete: 'Hello, here is my PasseTemps request',
    reference: 'Reference',
    service: 'Service',
    date: 'Date',
    vol: 'Flight',
    personnes: 'People',
    lieu: 'Location',
    position: 'Map location',
    delegation: 'Country of origin',
    nom: 'Name',
    telephone: 'Phone',
    precisions: 'Details',
  },

  familles: {
    transport: {
      eyebrow: 'Transport',
      titre: 'A driver, from the airport to your door',
      intro: 'AIBD airport transfers, daily rides, a car with driver by the day: tell us what you need.',
      conseil: 'The TER train links Dakar, Diamniadio and AIBD airport. For Saly, Somone or Thiès, plan on a car.',
      seo: {
        titre: 'Transport in Senegal: AIBD airport transfer and private driver',
        description: 'AIBD airport transfers, daily rides and a car with driver in Dakar, Saly and on the Petite Côte. Price confirmed on WhatsApp.',
      },
    },
    restauration: {
      eyebrow: 'Meals',
      titre: 'Meals that suit you, wherever you stay',
      intro: 'Breakfast at your accommodation, packed meals to go, a table at a partner restaurant — halal, vegetarian or allergen-free on request.',
      conseil: 'Tell us your diets and times in the details: we pass them on to the restaurant.',
      seo: {
        titre: 'Meals in Senegal: breakfast, packed meals and restaurants',
        description: 'Breakfast served at your accommodation, packed meals and tables at partner restaurants in Dakar and on the Petite Côte. Price confirmed on WhatsApp.',
      },
    },
  },

  autreService: 'See also',
}

export const TEXTES_PRESTATIONS = { fr, en }

export type TextesPrestations = typeof fr

/** Le chemin de la page d'une famille, sans préfixe de langue. */
export const CHEMIN_FAMILLE: Record<FamillePrestation, string> = {
  transport: '/transport/',
  restauration: '/restauration/',
}

/** La variable Railway qui ouvre chaque famille, citée dans l'aperçu. */
export const VARIABLE_FAMILLE: Record<FamillePrestation, string> = {
  transport: 'TRANSPORT_ACTIF',
  restauration: 'RESTAURATION_ACTIVE',
}
