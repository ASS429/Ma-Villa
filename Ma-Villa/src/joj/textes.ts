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
    dakar: 'Le Tour de l’Œuf, le stade Iba-Mar-Diop et la Corniche Ouest. Le TER mène à Diamniadio et à l’aéroport.',
    diamniadio: 'Le stade Abdoulaye-Wade, où les Jeux s’ouvrent le 31 octobre, Dakar Arena, le Centre des expositions et le Centre équestre.',
    saly: 'Saly Beach West : voile, aviron de mer, beach-volley, handball de plage, lutte de plage et triathlon.',
  },
  aucunLogementDiamniadio: 'Pas encore de logement sur place. Depuis Dakar, le TER y mène ; depuis Saly, une navette officielle part du stade de Mbour.',
  voirTous: (n: number, ville: string) => `Voir ${n > 1 ? `les ${n} logements` : 'le logement'} à ${ville}`,
  aussiThies: 'Aussi à Thiès : plus calme, à l’écart des sites. Une navette officielle part de la place de France vers Diamniadio.',
  voirThies: 'Logements à Thiès',

  services: 'Les services',
  servicesSous: 'Chacun à son prix, à part du logement. Vous prenez ce dont vous avez besoin.',
  pageDuService: (nom: string) => `Tout sur le service ${nom.toLowerCase()}`,

  // D'après le guide de la mobilité du ministère des Transports terrestres et
  // aériens et du CETUD (octobre 2026). Faits seulement : ni carte ni logo repris.
  deplacement: {
    titre: 'Se déplacer pendant les Jeux',
    intro: 'Les restrictions de circulation entrent en vigueur le 30 octobre. Autour des sites, seuls les véhicules accrédités circulent : '
      + 'nos chauffeurs vous déposent au point autorisé le plus proche de l’entrée. Les transports publics sont renforcés pendant toute la durée des Jeux.',
    allerAuxSites: 'Pour aller aux sites',
    poles: [
      {
        nom: 'Dakar',
        acces: '',
        sites: [
          { nom: 'Complexe Tour de l’Œuf', lieu: 'Point E', epreuves: 'Natation, basket 3x3, breaking, baseball5, skateboard', acces: 'BRT, station Dial Diop' },
          { nom: 'Complexe Iba-Mar-Diop', lieu: 'Médina', epreuves: 'Rugby à 7, athlétisme, boxe, futsal', acces: 'BRT, station Grande Mosquée ou Papa Gueye Fall' },
          { nom: 'Corniche Ouest', lieu: '', epreuves: 'Cyclisme sur route, et une fan zone pour s’initier à une dizaine de sports', acces: 'Minibus pour les spectateurs, toutes les 5 à 10 min' },
        ],
      },
      {
        nom: 'Diamniadio',
        acces: 'TER jusqu’à la gare de Diamniadio, un train toutes les 8 min depuis Dakar, puis le bus Dem Dikk 504A. Depuis Thiès, le train GTS.',
        sites: [
          { nom: 'Stade Abdoulaye-Wade', lieu: '', epreuves: 'Cérémonie d’ouverture, tir à l’arc', acces: '' },
          { nom: 'Dakar Arena', lieu: '', epreuves: 'Badminton, futsal', acces: '' },
          { nom: 'Centre des expositions', lieu: '', epreuves: 'Escrime, taekwondo, tennis de table, wushu, gymnastique artistique, judo', acces: '' },
          { nom: 'Centre équestre', lieu: '', epreuves: 'Saut d’obstacles', acces: '' },
        ],
      },
      {
        nom: 'Saly',
        acces: 'Seulement par les navettes officielles : depuis Grand Médine toutes les 45 min, ou depuis le stade de Mbour toutes les 15 min. '
          + 'Les voitures déposent au Saly Center. Motos et tricycles sont interdits pendant les Jeux.',
        sites: [
          { nom: 'Saly Beach West', lieu: '', epreuves: 'Voile, aviron de mer, beach-volley, handball de plage, lutte de plage, triathlon', acces: '' },
        ],
      },
    ],
    navettes: 'Les navettes officielles',
    navettesTexte: 'De 6 h 30 à 22 h, au départ de huit points :',
    departs: [
      'Ouakam, monument de la Renaissance',
      'Grand Médine, pôle d’échange du BRT',
      'Pikine, arène nationale de lutte',
      'Guédiawaye, stade Amadou-Barry',
      'Keur Massar, ancienne station Total',
      'Rufisque, gare routière',
      'Thiès, place de France',
      'Mbour, stade',
    ],
    dates: 'Les dates à retenir',
    calendrier: [
      { quand: '30 octobre', quoi: 'Les restrictions de circulation entrent en vigueur.' },
      { quand: 'Samedi 31 octobre', quoi: 'Cérémonie d’ouverture au stade Abdoulaye-Wade : 50 000 personnes attendues. Le public y accède par la sortie 12 de l’autoroute.' },
      { quand: 'Jeudi 5 et vendredi 6 novembre', quoi: 'Route entre Saly et Ngaparou fermée pendant le triathlon.' },
      { quand: 'Samedi 7, dimanche 8 et mardi 10 novembre', quoi: 'Corniche Ouest fermée dans les deux sens, de 6 h à 16 h.' },
      { quand: 'Dimanche 8 et mardi 10 novembre', quoi: 'Route entre Saly et Ngaparou fermée pendant le cyclisme.' },
      { quand: 'Vendredi 13 novembre', quoi: 'Clôture des Jeux. Les mesures sont levées le lendemain.' },
    ],
    sources: 'D’après le guide de la mobilité du ministère des Transports terrestres et aériens et du CETUD. '
      + 'Horaires et itinéraires à jour dans l’application CETUD Mobilités et sur',
  },

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
    dakar: 'The Tour de l’Œuf, the Iba-Mar-Diop stadium and the Corniche Ouest. The TER train runs to Diamniadio and the airport.',
    diamniadio: 'The Abdoulaye-Wade stadium, where the Games open on 31 October, Dakar Arena, the Exhibition Centre and the Equestrian Centre.',
    saly: 'Saly Beach West: sailing, coastal rowing, beach volleyball, beach handball, beach wrestling and triathlon.',
  },
  aucunLogementDiamniadio: 'No accommodation there yet. From Dakar, take the TER train; from Saly, an official shuttle leaves from the Mbour stadium.',
  voirTous: (n: number, ville: string) => `See ${n > 1 ? `all ${n} places` : 'the place'} in ${ville}`,
  aussiThies: 'Also in Thiès: quieter, away from the venues. An official shuttle runs from Place de France to Diamniadio.',
  voirThies: 'Places in Thiès',

  services: 'Services',
  servicesSous: 'Each at its own price, separate from your accommodation. Take only what you need.',
  pageDuService: (nom: string) => `All about ${nom.toLowerCase()}`,

  deplacement: {
    titre: 'Getting around during the Games',
    intro: 'Traffic restrictions come into force on 30 October. Around the venues, only accredited vehicles may drive: '
      + 'our drivers drop you at the authorised point nearest the entrance. Public transport runs extra services throughout the Games.',
    allerAuxSites: 'Getting to the venues',
    poles: [
      {
        nom: 'Dakar',
        acces: '',
        sites: [
          { nom: 'Tour de l’Œuf complex', lieu: 'Point E', epreuves: 'Swimming, 3x3 basketball, breaking, baseball5, skateboarding', acces: 'BRT, Dial Diop station' },
          { nom: 'Iba-Mar-Diop complex', lieu: 'Médina', epreuves: 'Rugby sevens, athletics, boxing, futsal', acces: 'BRT, Grande Mosquée or Papa Gueye Fall station' },
          { nom: 'Corniche Ouest', lieu: '', epreuves: 'Road cycling, and a fan zone to try about ten sports', acces: 'Spectator minibuses every 5 to 10 min' },
        ],
      },
      {
        nom: 'Diamniadio',
        acces: 'TER train to Diamniadio station, every 8 min from Dakar, then the Dem Dikk 504A bus. From Thiès, the GTS train.',
        sites: [
          { nom: 'Abdoulaye-Wade stadium', lieu: '', epreuves: 'Opening ceremony, archery', acces: '' },
          { nom: 'Dakar Arena', lieu: '', epreuves: 'Badminton, futsal', acces: '' },
          { nom: 'Exhibition Centre', lieu: '', epreuves: 'Fencing, taekwondo, table tennis, wushu, artistic gymnastics, judo', acces: '' },
          { nom: 'Equestrian Centre', lieu: '', epreuves: 'Show jumping', acces: '' },
        ],
      },
      {
        nom: 'Saly',
        acces: 'Official shuttles only: from Grand Médine every 45 min, or from the Mbour stadium every 15 min. '
          + 'Cars drop off at Saly Center. Motorbikes and tricycles are banned during the Games.',
        sites: [
          { nom: 'Saly Beach West', lieu: '', epreuves: 'Sailing, coastal rowing, beach volleyball, beach handball, beach wrestling, triathlon', acces: '' },
        ],
      },
    ],
    navettes: 'Official shuttles',
    navettesTexte: 'From 6:30 am to 10 pm, from eight departure points:',
    departs: [
      'Ouakam, African Renaissance Monument',
      'Grand Médine, BRT interchange',
      'Pikine, national wrestling arena',
      'Guédiawaye, Amadou-Barry stadium',
      'Keur Massar, former Total station',
      'Rufisque, bus station',
      'Thiès, Place de France',
      'Mbour, stadium',
    ],
    dates: 'Key dates',
    calendrier: [
      { quand: '30 October', quoi: 'Traffic restrictions come into force.' },
      { quand: 'Saturday 31 October', quoi: 'Opening ceremony at the Abdoulaye-Wade stadium: 50,000 people expected. The public enters via exit 12 of the motorway.' },
      { quand: 'Thursday 5 and Friday 6 November', quoi: 'Road between Saly and Ngaparou closed during the triathlon.' },
      { quand: 'Saturday 7, Sunday 8 and Tuesday 10 November', quoi: 'Corniche Ouest closed in both directions, 6 am to 4 pm.' },
      { quand: 'Sunday 8 and Tuesday 10 November', quoi: 'Road between Saly and Ngaparou closed during the cycling.' },
      { quand: 'Friday 13 November', quoi: 'Closing of the Games. Measures are lifted the next day.' },
    ],
    sources: 'Based on the mobility guide of Senegal’s Ministry of Land and Air Transport and CETUD. '
      + 'Up-to-date times and routes in the CETUD Mobilités app and on',
  },

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
