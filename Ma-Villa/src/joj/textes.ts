/**
 * Les textes de la vitrine JOJ, en deux langues. Les textes des services
 * (formulaire, prix, étapes) sont dans `src/prestations/textes.ts` : ils
 * restent après les Jeux.
 */

const fr = {
  eyebrow: 'JOJ Dakar 2026 · 31 octobre – 13 novembre',
  titre: 'Vous accompagnez un athlète ? Vivez les Jeux sans souci',
  intro: 'Votre athlète loge au village olympique. Vous, vous logez à Dakar ou sur la Petite Côte, entre des sites séparés de 30 à 80 km. '
    + 'PasseTemps vous trouve un logement, un chauffeur depuis l’aéroport et des repas qui vous conviennent.',
  demander: 'Demander un service',
  voirLogements: 'Voir les logements',

  ouLoger: 'Où loger',
  ouLogerSous: 'Les trois villes des Jeux, et les logements que nous y proposons.',
  sites: {
    dakar: 'Les épreuves en ville. Le TER mène à Diamniadio et à l’aéroport.',
    diamniadio: 'Le village olympique, Dakar Arena et le stade Abdoulaye-Wade.',
    saly: 'Les épreuves de plage et de mer : beach-volley, handball de plage, lutte de plage, voile…',
  },
  aucunLogementDiamniadio: 'Pas encore de logement sur place. Depuis Dakar, le TER y mène ; depuis Saly, prévoyez une voiture.',
  voirTous: (n: number, ville: string) => `Voir ${n > 1 ? `les ${n} logements` : 'le logement'} à ${ville}`,
  aussiThies: 'Aussi à Thiès : plus calme, à l’écart des sites — prévoyez une voiture avec chauffeur.',
  voirThies: 'Logements à Thiès',

  services: 'Les services',
  servicesSous: 'Chacun à son prix, à part du logement. Vous prenez ce dont vous avez besoin.',
  pageDuService: (nom: string) => `Tout sur le service ${nom.toLowerCase()}`,

  seDeplacer: 'Se déplacer pendant les Jeux',
  seDeplacerTexte: 'Des restrictions de circulation s’appliquent autour des sites depuis le 17 octobre, et certaines voies sont réservées aux navettes officielles. '
    + 'Nos chauffeurs vous déposent au point autorisé le plus proche de l’entrée.',

  billets: 'Les billets s’achètent sur la billetterie officielle',
  avertissement: 'PasseTemps n’est ni partenaire ni fournisseur officiel des Jeux Olympiques de la Jeunesse Dakar 2026. '
    + 'Les prix sont indicatifs et confirmés avant tout engagement.',
  reessayer: 'Réessayer',

  seo: {
    titre: 'JOJ Dakar 2026 : le séjour des familles d’athlètes',
    description: 'Vous accompagnez un athlète aux JOJ Dakar 2026 ? Logements à Dakar et à Saly, transfert depuis l’aéroport AIBD, trajets vers les sites et repas, confirmés sur WhatsApp.',
  },

  bandeau: {
    eyebrow: 'JOJ Dakar 2026 · 31 oct. – 13 nov.',
    titre: 'Vous accompagnez un athlète ?',
    texte: 'Logement, transfert depuis l’aéroport, repas : on s’occupe de tout, vous n’avez plus qu’à l’encourager.',
    bouton: 'Préparer mon séjour',
  },
}

const en: typeof fr = {
  eyebrow: 'Dakar 2026 Youth Olympic Games · 31 October – 13 November',
  titre: 'Supporting an athlete? Enjoy the Games, worry-free',
  intro: 'Your athlete stays in the Olympic village. You stay in Dakar or on the Petite Côte, between venues 30 to 80 km apart. '
    + 'PasseTemps finds you a place to stay, a driver from the airport and meals that suit you.',
  demander: 'Request a service',
  voirLogements: 'See places to stay',

  ouLoger: 'Where to stay',
  ouLogerSous: 'The three host cities, and the places we offer in each.',
  sites: {
    dakar: 'The city events. The TER train runs to Diamniadio and the airport.',
    diamniadio: 'The Olympic village, Dakar Arena and the Abdoulaye-Wade stadium.',
    saly: 'Beach and sea events: beach volleyball, beach handball, beach wrestling, sailing…',
  },
  aucunLogementDiamniadio: 'No accommodation there yet. From Dakar, take the TER train; from Saly, plan on a car.',
  voirTous: (n: number, ville: string) => `See ${n > 1 ? `all ${n} places` : 'the place'} in ${ville}`,
  aussiThies: 'Also in Thiès: quieter, away from the venues — plan on a car with driver.',
  voirThies: 'Places in Thiès',

  services: 'Services',
  servicesSous: 'Each at its own price, separate from your accommodation. Take only what you need.',
  pageDuService: (nom: string) => `All about ${nom.toLowerCase()}`,

  seDeplacer: 'Getting around during the Games',
  seDeplacerTexte: 'Traffic restrictions apply around the venues since 17 October, and some lanes are reserved for official shuttles. '
    + 'Our drivers drop you at the authorised point nearest the entrance.',

  billets: 'Tickets are sold on the official ticketing site',
  avertissement: 'PasseTemps is neither a partner nor an official supplier of the Dakar 2026 Youth Olympic Games. '
    + 'Prices are indicative and confirmed before any commitment.',
  reessayer: 'Try again',

  seo: {
    titre: 'Dakar 2026: a stay for athletes’ families',
    description: 'Supporting an athlete at the Dakar 2026 Youth Olympic Games? Places to stay in Dakar and Saly, airport transfers, rides to the venues and meals, confirmed on WhatsApp.',
  },

  bandeau: {
    eyebrow: 'Dakar 2026 · 31 Oct – 13 Nov',
    titre: 'Supporting an athlete?',
    texte: 'Accommodation, airport transfer, meals: we take care of it all, so you can focus on cheering.',
    bouton: 'Plan my stay',
  },
}

export const TEXTES_JOJ = { fr, en }

export type TextesJoj = typeof fr
