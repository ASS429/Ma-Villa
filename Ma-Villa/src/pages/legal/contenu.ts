/**
 * Textes légaux — note d'attente, en place depuis le 20 août 2026.
 *
 * Les textes précédents, relus le 12 août, affirmaient que la plateforme
 * n'encaisse aucun paiement et que le règlement se fait directement entre le
 * client et le propriétaire. C'est devenu faux le 18 août 2026, jour du premier
 * encaissement réel : PasseTemps encaisse, prélève une commission, et détient les
 * fonds jusqu'au reversement.
 *
 * Les laisser en ligne présentés comme définitifs exposait à ce qu'un client
 * les oppose à la plateforme dans un litige — sur des remboursements, ou sur la
 * détention de fonds pour compte de tiers.
 *
 * Ce module ne contient donc plus de clauses, mais **une description factuelle
 * de ce que le logiciel fait réellement**, vérifiable dans le code, et l'annonce
 * que la rédaction est confiée à un juriste. `TEXTES_PROVISOIRES` est à `true` :
 * le bandeau de `PageLegale` le dit en tête de chaque page.
 *
 * ⚠️ Ne pas repasser le drapeau à `false` avant d'avoir intégré les textes
 * **validés** par le juriste. Le projet de CGU v2 qui se trouve dans
 * `docs/juridique/v2-encaissement/` est une proposition qui lui est soumise,
 * pas un texte validé : le publier reviendrait à recommencer la même erreur.
 */

export interface Section {
  titre: string
  paragraphes: string[]
  liste?: string[]
}

export interface DocumentLegal {
  cle: 'cgu' | 'confidentialite' | 'annulation' | 'mentions'
  titre: string
  description: string
  miseAJour: string
  chapeau: string
  sections: Section[]
}

const MAJ = '20 août 2026'
const EXPLOITANT = 'PasseTemps'
const CONTACT = 'contactsmavilla@gmail.com'

/**
 * Bandeau d'avertissement en tête des pages légales.
 *
 * À `true` depuis le 20 août 2026 : voir l'en-tête du module.
 */
export const TEXTES_PROVISOIRES = true

/** Rédaction en cours — la même annonce sur les quatre documents. */
const REDACTION: Section = {
  titre: 'Rédaction en cours',
  paragraphes: [
    `Ce document est en cours de rédaction par le conseil juridique de ${EXPLOITANT}. Il sera publié ici dès qu'il aura été validé, et remplacera intégralement la présente note.`,
    'En attendant, cette page décrit sans détour le fonctionnement réel du service, afin que personne ne s\'engage sur une information inexacte. Elle ne tient pas lieu de conditions contractuelles.',
    `Pour toute question, écrivez à ${CONTACT}. Une réponse écrite vous sera adressée.`,
  ],
}

/** Ce que la plateforme fait de l'argent — le point qui rendait les textes faux. */
const ARGENT: Section = {
  titre: 'Ce que devient votre paiement',
  paragraphes: [
    'Depuis le 18 août 2026, le règlement d\'une réservation s\'effectue en ligne, par Wave ou Orange Money, via le prestataire de paiement PayDunya.',
    `Le montant est encaissé par ${EXPLOITANT}, et non par le propriétaire. ${EXPLOITANT} en retient une commission, puis reverse le solde au propriétaire après la fin du séjour. Entre l'encaissement et ce reversement, les fonds sont détenus par la plateforme.`,
    'La commission est prélevée sur le montant affiché : le prix indiqué sur l\'annonce est celui que vous réglez, jamais un prix auquel s\'ajouterait un supplément.',
  ],
  liste: [
    'Commission de 10 % sur les réservations inférieures à 50 000 FCFA.',
    'Commission de 20 % à partir de 50 000 FCFA.',
    'Aucun autre frais n\'est prélevé au client.',
  ],
}

export const DOCUMENTS: Record<DocumentLegal['cle'], DocumentLegal> = {
  cgu: {
    cle: 'cgu',
    titre: 'Conditions générales d\'utilisation',
    description: 'Conditions générales de PasseTemps — document en cours de rédaction par notre conseil juridique.',
    miseAJour: MAJ,
    chapeau:
      'Nos conditions générales sont en cours de rédaction par un juriste. Cette page décrit en attendant le fonctionnement réel de la plateforme.',
    sections: [
      REDACTION,
      {
        titre: 'Ce qu\'est PasseTemps',
        paragraphes: [
          `${EXPLOITANT} met en relation des propriétaires de villas et de logements de vacances situés au Sénégal avec des clients souhaitant les louer.`,
          'Le séjour lui-même est fourni par le propriétaire, qui reste responsable de l\'état du bien, de sa conformité à l\'annonce et du déroulement du séjour.',
          'Chaque annonce est examinée par notre équipe avant d\'être publiée.',
        ],
      },
      ARGENT,
      {
        titre: 'Réserver',
        paragraphes: [
          'Une demande de réservation est envoyée au propriétaire, qui l\'accepte ou la refuse. Le règlement intervient ensuite, et confirme le séjour.',
          'Les coordonnées du propriétaire vous sont communiquées une fois la réservation confirmée. Avant cela, toutes vos questions passent par la messagerie rattachée à votre réservation, qui en conserve la trace.',
        ],
      },
      {
        titre: 'Avis',
        paragraphes: [
          'Seul un client ayant effectivement séjourné dans un logement peut en publier un avis.',
        ],
      },
    ],
  },

  confidentialite: {
    cle: 'confidentialite',
    titre: 'Politique de confidentialité',
    description: 'Traitement des données personnelles par PasseTemps — document en cours de rédaction par notre conseil juridique.',
    miseAJour: MAJ,
    chapeau:
      'Notre politique de confidentialité est en cours de rédaction par un juriste. Cette page indique en attendant quelles données nous détenons et pourquoi.',
    sections: [
      REDACTION,
      {
        titre: 'Ce que nous conservons',
        paragraphes: [
          'Les données ci-dessous sont celles que le service enregistre pour fonctionner.',
        ],
        liste: [
          'Votre compte : nom, adresse électronique, numéro de téléphone, mot de passe chiffré.',
          'Vos réservations : dates, logement, montant, statut du paiement.',
          'Vos messages échangés avec un propriétaire au sujet d\'une réservation.',
          'Vos avis, vos favoris, et les annonces que vous publiez si vous êtes propriétaire.',
          'Si vous acceptez les notifications, l\'identifiant technique de votre navigateur ou de votre téléphone.',
        ],
      },
      {
        titre: 'Ce que nous ne faisons pas',
        paragraphes: [
          'Vos coordonnées ne sont ni vendues, ni cédées, ni transmises à des tiers à des fins de démarchage.',
          'Votre numéro de téléphone n\'apparaît pas publiquement. Il n\'est communiqué à l\'autre partie qu\'une fois une réservation confirmée entre vous.',
          'Nous ne conservons aucune donnée de carte bancaire : les paiements sont traités par PayDunya, qui ne nous transmet pas ces informations.',
        ],
      },
      {
        titre: 'Où sont hébergées vos données',
        paragraphes: [
          'Le site et l\'application sont hébergés par Render ; la base de données et le service applicatif le sont par Railway. Les photographies des annonces sont stockées chez Cloudflare R2.',
          `Pour demander l'accès à vos données, leur correction ou la suppression de votre compte, écrivez à ${CONTACT}.`,
        ],
      },
    ],
  },

  annulation: {
    cle: 'annulation',
    titre: 'Annulation et remboursement',
    description: 'Conditions d\'annulation et de remboursement — document en cours de rédaction par notre conseil juridique.',
    miseAJour: MAJ,
    chapeau:
      'Nos conditions d\'annulation sont en cours de rédaction par un juriste. Cette page indique en attendant comment une demande est traitée.',
    sections: [
      REDACTION,
      {
        titre: 'En attendant la publication du barème',
        paragraphes: [
          'Aucun barème d\'annulation automatique n\'est en vigueur à ce jour. Nous ne pouvons donc pas vous annoncer par avance un pourcentage de remboursement.',
          'Toute demande d\'annulation est traitée individuellement, par écrit, et une réponse motivée vous est adressée.',
          'Une réservation annulée reste consultable dans votre espace, et sa messagerie reste ouverte : c\'est là que la demande se règle, et la conversation en garde la trace.',
        ],
      },
      {
        titre: 'Comment demander une annulation',
        paragraphes: [
          'Ouvrez la réservation concernée depuis votre espace, puis écrivez au propriétaire par la messagerie. Vous pouvez annuler vous-même une demande tant qu\'elle n\'a pas été acceptée.',
          `Si la demande porte sur un remboursement, écrivez également à ${CONTACT} : c'est ${EXPLOITANT} qui détient les fonds jusqu'au reversement, et donc ${EXPLOITANT} qui procède au remboursement le cas échéant.`,
        ],
      },
    ],
  },

  mentions: {
    cle: 'mentions',
    titre: 'Mentions légales',
    description: 'Éditeur, hébergeur et contact de la plateforme PasseTemps.',
    miseAJour: MAJ,
    chapeau:
      'Nos mentions légales sont en cours de complétion par un juriste. Les informations vérifiées figurent ci-dessous.',
    sections: [
      REDACTION,
      {
        titre: 'Éditeur',
        paragraphes: [
          `Le site PasseTemps est édité par ${EXPLOITANT}.`,
          `Contact : ${CONTACT}.`,
          'La forme juridique de l\'exploitant, son immatriculation et l\'identité de son directeur de publication seront précisées ici dès que le juriste aura arrêté la structure retenue.',
        ],
      },
      {
        titre: 'Hébergement',
        paragraphes: [
          'Le site est hébergé par Render. Le service applicatif et la base de données le sont par Railway. Les photographies sont stockées chez Cloudflare R2.',
        ],
      },
      {
        titre: 'Paiements',
        paragraphes: [
          'Les paiements en ligne sont traités par PayDunya, prestataire de services de paiement, pour les moyens Wave et Orange Money.',
        ],
      },
    ],
  },
}
