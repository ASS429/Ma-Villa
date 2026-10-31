/**
 * Les textes partagés par toutes les pages client : navigation, pied de page,
 * mots de tous les jours. Un dictionnaire par zone du site plutôt qu'un seul
 * fichier pour tout — celui d'Agence Touristique en compte 5 350 lignes, et
 * plus personne n'y retrouve une clé.
 *
 * `en` est typé sur `fr` : une clé oubliée dans une langue ne compile pas.
 */

const fr = {
  nav: {
    hebergements: 'Hébergements',
    boutique: 'Boutique',
    monEspace: 'Mon espace',
    admin: 'Admin',
    mesCommandes: 'Mes commandes',
    connexion: 'Connexion',
    inscrire: 'S’inscrire',
    deconnexion: 'Déconnexion',
    menu: 'Menu',
    fermerMenu: 'Fermer le menu',
    themeClair: 'Passer au thème clair',
    themeSombre: 'Passer au thème sombre',
    allerAuContenu: 'Aller au contenu',
    accueil: 'PasseTemps — accueil',
  },
  pied: {
    accroche: 'Villas, résidences, appartements et chambres à louer au Sénégal.',
    region: 'Pied de page',
    explorer: 'Explorer',
    tousLesHebergements: 'Tous les hébergements',
    informations: 'Informations',
    cgu: 'Conditions générales',
    confidentialite: 'Confidentialité',
    annulation: 'Politique d’annulation',
    vente: 'Conditions de vente',
    mentions: 'Mentions légales',
    suivre: 'Suivez-nous',
    pays: 'Sénégal',
  },
  basse: {
    explorer: 'Explorer',
    recherche: 'Recherche',
    reservations: 'Réservations',
    compte: 'Compte',
    navigation: 'Navigation principale',
  },
  langue: {
    nom: { fr: 'Français', en: 'English' },
    court: { fr: 'FR', en: 'EN' },
    versionDans: { fr: 'Version française', en: 'English version' },
  },
  commun: {
    reessayer: 'Réessayer',
    patientez: 'Patientez…',
    voirTout: 'Voir tout',
    fermer: 'Fermer',
    retour: 'Retour',
  },
}

const en: typeof fr = {
  nav: {
    hebergements: 'Places to stay',
    boutique: 'Shop',
    monEspace: 'My account',
    admin: 'Admin',
    mesCommandes: 'My orders',
    connexion: 'Log in',
    inscrire: 'Sign up',
    deconnexion: 'Log out',
    menu: 'Menu',
    fermerMenu: 'Close the menu',
    themeClair: 'Switch to light theme',
    themeSombre: 'Switch to dark theme',
    allerAuContenu: 'Skip to content',
    accueil: 'PasseTemps — home',
  },
  pied: {
    accroche: 'Villas, residences, apartments and rooms for rent in Senegal.',
    region: 'Footer',
    explorer: 'Explore',
    tousLesHebergements: 'All places to stay',
    informations: 'Information',
    cgu: 'Terms of use',
    confidentialite: 'Privacy',
    annulation: 'Cancellation policy',
    vente: 'Terms of sale',
    mentions: 'Legal notice',
    suivre: 'Follow us',
    pays: 'Senegal',
  },
  basse: {
    explorer: 'Explore',
    recherche: 'Search',
    reservations: 'Bookings',
    compte: 'Account',
    navigation: 'Main navigation',
  },
  langue: fr.langue,
  commun: {
    reessayer: 'Try again',
    patientez: 'Please wait…',
    voirTout: 'See all',
    fermer: 'Close',
    retour: 'Back',
  },
}

export const COMMUN = { fr, en }
