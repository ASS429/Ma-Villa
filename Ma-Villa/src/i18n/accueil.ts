/** Les textes de la page d'accueil, dans les deux langues. */

const fr = {
  seo: {
    description: 'Louez une villa, une résidence, un appartement ou une chambre au Sénégal — Saly, Mbour, Dakar. Tarifs affichés, disponibilités en temps réel.',
    site: 'Villas, résidences, appartements et chambres à louer au Sénégal',
  },
  hero: {
    titre: 'Votre séjour au Sénégal',
    suite: 'réservé en trois gestes',
    accroche: 'Villas, résidences, appartements, chambres — à la nuitée comme à la journée.',
    accrocheCourte: 'Villas, résidences, appartements ou chambres.',
    bientot: (nom: string) => ` Réservation en ligne bientôt disponible. En attendant, contactez ${nom} au `,
    paiement: (moyens: string) => ` Paiement ${moyens}.`,
    paiementBientot: (moyens: string) => ` Paiement ${moyens} bientôt disponible.`,
    ou: ' ou ',
  },
  categories: { eyebrow: 'Par catégorie', titre: 'Que cherchez-vous ?' },
  destinations: {
    eyebrow: 'Destinations',
    titre: 'Où allez-vous ?',
    nb: (n: number) => `${n} hébergement${n > 1 ? 's' : ''}`,
    des: (prix: string) => ` · dès ${prix}`,
  },
  vedette: { eyebrow: 'Sélection', titre: 'Hébergements en vedette', voirTout: 'Voir toutes →', favorisImpossible: 'Impossible de mettre à jour vos favoris.' },
  etapes: {
    eyebrow: 'Comment ça marche',
    titre: 'Réserver en trois étapes',
    cherchez: { titre: 'Cherchez', texte: 'Filtrez par ville, dates et budget. Les prix sont affichés, sans surprise.' },
    reservez: { titre: 'Réservez', texte: 'Choisissez un logement et une formule : à la nuitée, à la journée ou à la demi-journée.' },
    profitezOuvert: { titre: 'Profitez', texte: 'Le propriétaire confirme, vous recevez ses coordonnées par email.' },
    contactez: (nom: string, tel: string) => ({ titre: 'Contactez-nous', texte: `La réservation en ligne arrive bientôt. En attendant, ${nom} prend vos demandes au ${tel}.` }),
    profitezFerme: { titre: 'Profitez', texte: 'Votre séjour est confirmé : il ne reste plus qu’à partir.' },
  },
  arguments: [
    { label: 'Partout au Sénégal', sub: 'Saly, Mbour, Dakar, Ziguinchor et plus encore' },
    { label: 'Annonces relues', sub: 'Chaque annonce est relue par notre équipe avant publication' },
    { label: 'Avis de vrais séjours', sub: 'Seuls les clients ayant séjourné peuvent laisser une note' },
  ],
  proprietaires: {
    eyebrow: 'Propriétaires',
    titre: 'Publiez votre hébergement gratuitement',
    texte: 'Créez votre annonce, fixez vos tarifs par formule — nuitée, journée, résidence — et gérez vos disponibilités depuis un tableau de bord simple.',
    bouton: 'Publier mon hébergement',
  },
}

const en: typeof fr = {
  seo: {
    description: 'Rent a villa, a residence, an apartment or a room in Senegal — Saly, Mbour, Dakar. Prices shown, live availability.',
    site: 'Villas, residences, apartments and rooms to rent in Senegal',
  },
  hero: {
    titre: 'Your stay in Senegal',
    suite: 'booked in three steps',
    accroche: 'Villas, residences, apartments, rooms — by the night or by the day.',
    accrocheCourte: 'Villas, residences, apartments or rooms.',
    bientot: (nom: string) => ` Online booking is coming soon. Meanwhile, contact ${nom} on `,
    paiement: (moyens: string) => ` Pay with ${moyens}.`,
    paiementBientot: (moyens: string) => ` Payment with ${moyens} coming soon.`,
    ou: ' or ',
  },
  categories: { eyebrow: 'By category', titre: 'What are you looking for?' },
  destinations: {
    eyebrow: 'Destinations',
    titre: 'Where are you going?',
    nb: (n: number) => `${n} place${n > 1 ? 's' : ''}`,
    des: (prix: string) => ` · from ${prix}`,
  },
  vedette: { eyebrow: 'Selection', titre: 'Featured places', voirTout: 'See all →', favorisImpossible: 'Your favourites could not be updated.' },
  etapes: {
    eyebrow: 'How it works',
    titre: 'Book in three steps',
    cherchez: { titre: 'Search', texte: 'Filter by town, dates and budget. Prices are shown upfront, no surprises.' },
    reservez: { titre: 'Book', texte: 'Pick a unit and an option: by the night, by the day or by the half-day.' },
    profitezOuvert: { titre: 'Enjoy', texte: 'The owner confirms and you get their contact details by email.' },
    contactez: (nom: string, tel: string) => ({ titre: 'Contact us', texte: `Online booking is coming soon. Meanwhile, ${nom} takes your requests on ${tel}.` }),
    profitezFerme: { titre: 'Enjoy', texte: 'Your stay is confirmed: all that is left is to pack.' },
  },
  arguments: [
    { label: 'All over Senegal', sub: 'Saly, Mbour, Dakar, Ziguinchor and more' },
    { label: 'Reviewed listings', sub: 'Every listing is reviewed by our team before it goes live' },
    { label: 'Reviews from real stays', sub: 'Only guests who have stayed can leave a rating' },
  ],
  proprietaires: {
    eyebrow: 'Owners',
    titre: 'List your place for free',
    texte: 'Create your listing, set your prices per option — night, day, residence — and manage availability from a simple dashboard.',
    bouton: 'List my place',
  },
}

export const TEXTES_ACCUEIL = { fr, en }
