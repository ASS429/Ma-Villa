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

const MAJ = '1er septembre 2026'
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
    'Commission de 10 % sur les 50 000 premiers francs de la réservation.',
    'Commission de 20 % sur la part qui dépasse 50 000 francs.',
    'Exemple : sur une réservation de 100 000 FCFA, la commission est de 15 000 FCFA — 5 000 sur la première tranche, 10 000 sur la seconde — et le propriétaire perçoit 85 000 FCFA.',
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
          'Le numéro de téléphone que vous indiquez pour payer, conservé afin de pouvoir vous rembourser sur ce même numéro le cas échéant.',
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
          'Le site et l\'application sont hébergés par Render ; la base de données et le service applicatif le sont par Railway. Les photographies des annonces sont stockées chez Cloudflare R2. Les courriels du service — confirmation d\'inscription, réinitialisation de mot de passe, jalons d\'une réservation — sont acheminés par Resend.',
          'Ces prestataires sont tous établis hors du Sénégal.',
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
        titre: 'Comment une annulation se décide',
        paragraphes: [
          `Aucun barème contractuel n'est publié à ce jour : la rédaction est confiée à un juriste, et ${EXPLOITANT} ne veut pas annoncer une règle qu'il faudrait ensuite corriger. Chaque demande est donc examinée individuellement, et une réponse motivée vous est adressée par écrit.`,
          'Deux éléments pèsent sur la décision, et vous pouvez les anticiper : qui est à l\'origine de l\'annulation, et combien de temps sépare la demande de la date d\'arrivée.',
          `Lorsque l'annulation est imputable à ${EXPLOITANT} ou au propriétaire — logement indisponible, séjour impossible à fournir — la somme réglée vous est rendue en entier, commission comprise.`,
          'Lorsque vous renoncez de votre fait, la part rendue diminue à mesure que la date d\'arrivée approche : le logement vous était réservé, et le propriétaire a refusé d\'autres clients pour ces dates.',
        ],
      },
      {
        titre: 'Comment demander une annulation',
        paragraphes: [
          'Tant qu\'aucun règlement n\'est intervenu, vous annulez vous-même votre demande depuis votre espace, sans formalité : il n\'y a alors aucune somme à rendre.',
          `Une fois la réservation réglée, le bouton devient « Demander l'annulation » et vous êtes invité à indiquer le motif. Votre demande est enregistrée, ${EXPLOITANT} l'examine, et le séjour reste réservé à votre nom jusqu'à la décision. Le motif compte : c'est lui qui détermine la somme rendue.`,
          `Le remboursement, s'il a lieu, est effectué par ${EXPLOITANT} sur le numéro qui a servi au paiement, puisque c'est ${EXPLOITANT} qui détient les fonds jusqu'au reversement. Pour toute question, écrivez à ${CONTACT}.`,
          `Une réservation annulée reste consultable dans votre espace, et sa messagerie reste ouverte : la conversation en garde la trace.`,
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
