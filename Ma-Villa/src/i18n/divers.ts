/**
 * Les petits textes transverses : invitation à installer l'application,
 * bandeau de nouvelle version, et la note qui accompagne les pages légales
 * en anglais.
 */

const fr = {
  installation: {
    titre: 'Garder PasseTemps sur votre écran',
    touchez: 'Touchez',
    partager: 'Partager',
    puis: 'puis',
    surEcran: '« Sur l’écran d’accueil »',
    horsLigne: 'Vos réservations consultables sans connexion.',
    ajouter: 'Ajouter',
    refuser: 'Ne pas installer',
  },
  version: { texte: 'Une version plus récente de PasseTemps est disponible.', recharger: 'Recharger' },
  legal: {
    miseAJour: 'Dernière mise à jour :',
    autres: 'Autres documents légaux',
    // Vide en français : la note ne concerne que la version anglaise.
    noteTitre: '',
    note: '',
  },
}

const en: typeof fr = {
  installation: {
    titre: 'Keep PasseTemps on your screen',
    touchez: 'Tap',
    partager: 'Share',
    puis: 'then',
    surEcran: '“Add to Home Screen”',
    horsLigne: 'Your bookings available offline.',
    ajouter: 'Add',
    refuser: 'Do not install',
  },
  version: { texte: 'A newer version of PasseTemps is available.', recharger: 'Reload' },
  legal: {
    miseAJour: 'Last updated:',
    autres: 'Other legal documents',
    noteTitre: 'This document is available in French only.',
    note: 'An English version is being prepared. Until then, the French text below is the one that applies. If anything is unclear, contact us.',
  },
}

export const TEXTES_DIVERS = { fr, en }
