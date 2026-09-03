/**
 * Textes légaux de PasseTemps — version publiée le 3 septembre 2026.
 *
 * Historique, parce qu'il explique la forme de ce fichier :
 *
 *   — jusqu'au 20 août, ce module portait des clauses rédigées le 10 août. Elles
 *     affirmaient que la plateforme n'encaisse aucun paiement, ce qui est devenu
 *     faux le 18 août, jour du premier encaissement réel ;
 *   — du 20 août au 3 septembre, il ne portait plus de clauses du tout, mais une
 *     note d'attente : une description factuelle du service, et l'annonce que la
 *     rédaction était confiée à un juriste ;
 *   — le 3 septembre, le juriste a retourné des textes eux aussi partis de la
 *     version du 10 août, avec les mêmes affirmations fausses. L'exploitant a
 *     décidé de les reprendre ici, à partir de ce que le logiciel fait vraiment.
 *
 * ⚠️ **Chaque affirmation de ce fichier doit être vérifiable dans le code.** Le
 * barème d'annulation vient de `backend/config/reservations.php`, la commission
 * de `backend/config/paiement.php`, les frais de livraison de
 * `backend/config/boutique.php`. Si l'un de ces réglages change, ce fichier est
 * à relire dans le même mouvement : ce n'est pas de la documentation, c'est du
 * texte opposable.
 *
 * Trois fois déjà une page légale est devenue fausse toute seule — l'encaissement
 * le 18 août, la commission par tranches le 21, le barème d'annulation le
 * 1er septembre. C'est le piège de ce fichier, et il n'a pas d'autre parade que
 * la relecture.
 */

export interface Section {
  titre: string
  paragraphes: string[]
  liste?: string[]
}

export interface DocumentLegal {
  cle: 'cgu' | 'confidentialite' | 'annulation' | 'mentions' | 'vente'
  titre: string
  description: string
  miseAJour: string
  chapeau: string
  sections: Section[]
}

const MAJ = '3 septembre 2026'
const EXPLOITANT = 'PasseTemps'
const CONTACT = 'contactptemps@gmail.com'
const DIRECTEUR = 'Abdou Ndour'

/**
 * Les textes ne sont plus provisoires depuis le 3 septembre 2026.
 *
 * Le bandeau qu'il commandait disait « ceci n'est pas un contrat ». Le garder
 * au-dessus de conditions complètes les aurait vidées de leur effet : un client
 * pouvait s'en servir pour écarter le barème qu'elles annoncent.
 *
 * Il reste exporté parce que `PageLegale` le lit, et qu'un jour de refonte on
 * peut vouloir le relever.
 */
export const TEXTES_PROVISOIRES = false

/* ══ Fragments partagés ═══════════════════════════════════════════ */

/** L'argent. Numéroté pour les CGU, seul document qui l'emploie. */
const ARGENT: Section = {
  titre: '5. Ce que devient votre paiement',
  paragraphes: [
    `Le règlement d'une réservation s'effectue en ligne, par Wave ou Orange Money, via le prestataire de paiement PayDunya.`,
    `Le montant est encaissé par ${EXPLOITANT}, et non par le propriétaire. ${EXPLOITANT} en retient une commission, puis reverse le solde au propriétaire après la fin du séjour. Entre l'encaissement et ce reversement, les fonds sont détenus par ${EXPLOITANT}.`,
    `La commission est prélevée sur le montant affiché : le prix indiqué sur l'annonce est celui que vous réglez, et aucun supplément ne s'y ajoute.`,
  ],
  liste: [
    'Commission de 10 % sur les 50 000 premiers francs de la réservation.',
    'Commission de 20 % sur la part qui dépasse 50 000 francs.',
    'Exemple : sur une réservation de 100 000 FCFA, la commission est de 15 000 FCFA — 5 000 sur la première tranche, 10 000 sur la seconde — et le propriétaire perçoit 85 000 FCFA.',
    'Aucun autre frais n’est prélevé au client.',
  ],
}

const CONTACT_SECTION: Section = {
  titre: '8. Nous écrire',
  paragraphes: [
    `Pour toute question relative à ce document, écrivez à ${CONTACT}. Une réponse écrite vous est adressée.`,
  ],
}

/* ══ Les documents ════════════════════════════════════════════════ */

export const DOCUMENTS: Record<DocumentLegal['cle'], DocumentLegal> = {
  cgu: {
    cle: 'cgu',
    titre: 'Conditions générales d\'utilisation',
    description: `Conditions générales d'utilisation de ${EXPLOITANT} : rôle de la plateforme, réservation, paiement, commission et responsabilités.`,
    miseAJour: MAJ,
    chapeau:
      `Les présentes conditions régissent l'utilisation de la plateforme ${EXPLOITANT}. En créant un compte, vous les acceptez.`,
    sections: [
      {
        titre: '1. Ce qu’est PasseTemps',
        paragraphes: [
          `${EXPLOITANT} met en relation des propriétaires de villas, résidences, appartements et chambres situés au Sénégal avec des clients souhaitant les louer pour un séjour.`,
          `Le séjour lui-même est fourni par le propriétaire, qui reste responsable de l'état du bien, de sa conformité à l'annonce et du déroulement du séjour. ${EXPLOITANT} n'est ni propriétaire, ni gestionnaire, ni loueur des biens présentés.`,
          `${EXPLOITANT} exerce en revanche deux activités qui lui sont propres : elle encaisse le prix des séjours et en détient les fonds jusqu'au reversement (article 5), et elle vend pour son propre compte les articles d'artisanat de sa boutique, régis par des conditions de vente distinctes.`,
        ],
      },
      {
        titre: '2. Compte',
        paragraphes: [
          `L'inscription est gratuite et ouverte à toute personne majeure. Trois rôles existent : client, propriétaire et administrateur.`,
          `Vous vous engagez à fournir des informations exactes et à les tenir à jour, notamment votre numéro de téléphone : c'est par lui que vous vous connectez, et c'est par lui qu'un remboursement vous parviendrait.`,
          `Vous êtes responsable de la confidentialité de votre mot de passe. Prévenez-nous sans délai si vous soupçonnez que votre compte est utilisé par un tiers.`,
        ],
      },
      {
        titre: '3. Annonces',
        paragraphes: [
          `Le propriétaire garantit qu'il détient les droits nécessaires pour louer le bien publié, et que les informations diffusées — description, photographies, tarifs, capacité, localisation — sont exactes et à jour.`,
          `Chaque annonce est examinée par ${EXPLOITANT} avant d'être publiée. Une annonce peut être refusée ou retirée ; le motif est alors écrit, communiqué au propriétaire et conservé.`,
          `Le propriétaire est seul responsable du respect de ses obligations légales et fiscales liées à son activité de location.`,
          `En publiant des photographies, le propriétaire concède à ${EXPLOITANT} une licence gratuite et non exclusive d'utilisation, aux seules fins de promouvoir son annonce et la plateforme.`,
        ],
      },
      {
        titre: '4. Réserver',
        paragraphes: [
          `Une demande de réservation précise le logement, la formule tarifaire, les dates et le nombre de personnes. Elle n'engage définitivement les parties qu'après confirmation par le propriétaire, puis règlement.`,
          `Le propriétaire dispose de 24 heures pour répondre. Passé ce délai, la demande est annulée automatiquement et les dates sont libérées. Aucune somme n'ayant été versée à ce stade, il n'y a rien à rembourser.`,
          `Le nombre de personnes déclaré ne peut excéder la capacité du logement. Tout dépassement autorise le propriétaire à refuser l'accès, sans remboursement.`,
          `Les coordonnées du propriétaire vous sont communiquées une fois la réservation confirmée ou réglée. Avant cela, toutes vos questions passent par la messagerie rattachée à votre réservation, qui en conserve la trace.`,
        ],
      },
      ARGENT,
      {
        titre: '6. Annulation et remboursement',
        paragraphes: [
          `Les règles d'annulation, le barème de remboursement et le délai dans lequel les sommes sont rendues font l'objet d'un document distinct : la politique d'annulation, qui fait partie intégrante des présentes conditions.`,
        ],
      },
      {
        titre: '7. Avis',
        paragraphes: [
          `Seul un client ayant effectivement séjourné dans un logement peut en publier un avis. Les avis engagent leur auteur.`,
          `${EXPLOITANT} peut retirer un avis manifestement injurieux, diffamatoire ou étranger au séjour. Elle ne retire pas un avis au seul motif qu'il est défavorable.`,
        ],
      },
      {
        titre: '8. Responsabilité',
        paragraphes: [
          `${EXPLOITANT} met en œuvre les moyens raisonnables pour assurer la disponibilité et la sécurité de la plateforme, sans garantir une continuité de service ininterrompue.`,
          `La responsabilité de ${EXPLOITANT} ne peut être engagée en cas de litige entre un client et un propriétaire, de dommage survenu pendant un séjour, ou d'inexécution imputable à l'une de ces deux parties.`,
          `Elle demeure en revanche responsable des sommes qu'elle encaisse et détient, jusqu'à leur reversement au propriétaire ou leur remboursement au client.`,
        ],
      },
      {
        titre: '9. Propriété intellectuelle',
        paragraphes: [
          `La marque, les textes, l'interface et le code de la plateforme sont protégés. Toute reproduction sans autorisation est interdite.`,
          `Les photographies des annonces demeurent la propriété de leurs auteurs.`,
        ],
      },
      {
        titre: '10. Modification des conditions',
        paragraphes: [
          `Ces conditions peuvent être modifiées pour suivre l'évolution du service ou de la réglementation. La date de dernière mise à jour figure en tête de page.`,
          `Une modification touchant le prix, la commission ou les règles de remboursement est annoncée aux utilisateurs avant son entrée en vigueur, et ne s'applique jamais à une réservation déjà réglée.`,
        ],
      },
      {
        titre: '11. Droit applicable',
        paragraphes: [
          `Les présentes conditions sont régies par le droit sénégalais. En cas de différend, les parties recherchent d'abord une solution amiable en nous écrivant à ${CONTACT}. À défaut, les tribunaux compétents de Dakar sont saisis.`,
        ],
      },
    ],
  },

  confidentialite: {
    cle: 'confidentialite',
    titre: 'Politique de confidentialité',
    description: `Données personnelles collectées par ${EXPLOITANT}, à quoi elles servent, combien de temps elles sont conservées et quels sont vos droits.`,
    miseAJour: MAJ,
    chapeau:
      `Cette page décrit les données que nous conservons, ce que nous en faisons, et les droits dont vous disposez sur elles.`,
    sections: [
      {
        titre: '1. Qui traite vos données',
        paragraphes: [
          `Les données collectées sur cette plateforme sont traitées par ${EXPLOITANT}, dont le siège est à Dakar, Sénégal. Le directeur de la publication est ${DIRECTEUR}.`,
          `Pour toute question relative à vos données, écrivez à ${CONTACT}.`,
        ],
      },
      {
        titre: '2. Ce que nous conservons',
        paragraphes: [
          `Les données ci-dessous sont celles que le service enregistre pour fonctionner. Nous n'en collectons pas d'autres.`,
        ],
        liste: [
          'Votre compte : nom, adresse électronique, numéro de téléphone, mot de passe chiffré, photographie de profil si vous en ajoutez une.',
          'Vos réservations : dates, logement, nombre de personnes, montant, statut du paiement.',
          'Le numéro de téléphone que vous indiquez pour payer, qui n’est pas nécessairement celui de votre compte. Il est conservé afin de pouvoir vous rembourser sur le numéro réellement débité.',
          'Vos messages échangés avec un propriétaire au sujet d’une réservation, et le motif que vous indiquez en demandant une annulation.',
          'Vos avis, vos favoris, et les annonces que vous publiez si vous êtes propriétaire — y compris la position sur la carte, si vous choisissez de la renseigner.',
          'Si vous acceptez les notifications, l’identifiant technique de votre navigateur ou de votre téléphone, un par appareil.',
          'Un journal des décisions d’administration : qui a validé, refusé ou retiré une annonce, enregistré un versement ou un remboursement, et quand.',
        ],
      },
      {
        titre: '3. À quoi elles servent',
        paragraphes: [
          `Vos données servent à fournir le service et à rien d'autre : créer et sécuriser votre compte, traiter vos réservations et vos paiements, vous permettre d'échanger avec l'autre partie, vous informer de l'avancement de votre séjour, et répondre à nos obligations comptables.`,
          `Le journal des décisions d'administration a une finalité propre : conserver la preuve de ce qui a été décidé, en cas de contestation.`,
        ],
      },
      {
        titre: '4. Qui les reçoit',
        paragraphes: [
          `Lorsqu'une réservation est confirmée ou réglée, le propriétaire et le client reçoivent réciproquement le nom et les coordonnées de l'autre. Cet échange est nécessaire à la réalisation du séjour, et il n'a pas lieu avant.`,
          `Vos données sont par ailleurs confiées aux prestataires techniques ci-dessous, dans la stricte limite de leur mission. Nous ne vendons, ne cédons et ne louons vos coordonnées à personne, et nous ne les transmettons à aucun tiers à des fins de démarchage.`,
        ],
        liste: [
          'Render Services, Inc. (États-Unis) — hébergement du site et de l’application.',
          'Railway Corporation (États-Unis) — hébergement de l’interface applicative et de la base de données.',
          'Cloudflare, Inc. (États-Unis) — stockage des photographies des annonces.',
          'Plus Five Five, Inc., qui exploite le service Resend (États-Unis) — acheminement des courriels du service.',
          'PayDunya (Sénégal) — traitement des paiements par Wave et Orange Money.',
        ],
      },
      {
        titre: '5. Transfert hors du Sénégal',
        paragraphes: [
          `Quatre de ces cinq prestataires sont établis aux États-Unis. Vos données y sont donc hébergées et traitées, hors du territoire sénégalais.`,
          `Nous n'avons retenu que des prestataires proposant un engagement contractuel de protection des données. Si vous ne souhaitez pas que vos données soient traitées hors du Sénégal, vous ne pouvez pas utiliser la plateforme : ce transfert est inhérent à son fonctionnement.`,
        ],
      },
      {
        titre: '6. Combien de temps nous les gardons',
        paragraphes: [
          `Les durées ci-dessous courent à compter du dernier événement concerné.`,
        ],
        liste: [
          'Compte : tant qu’il est ouvert. Vous pouvez demander sa suppression à tout moment.',
          'Réservations, paiements, remboursements et numéro du payeur : dix ans, durée de conservation des pièces comptables. Ces données survivent à la suppression du compte, sous une forme réduite à ce qui est comptablement nécessaire.',
          'Messages échangés au sujet d’une réservation : trois ans après la fin du séjour.',
          'Journal des décisions d’administration : cinq ans, parce que c’est la seule pièce produisible en cas de litige.',
          'Abonnement aux notifications : jusqu’à ce que vous les désactiviez ou désinstalliez l’application.',
          'Avis publiés : tant que l’annonce concernée existe.',
        ],
      },
      {
        titre: '7. Ce que nous ne faisons pas',
        paragraphes: [
          `Nous ne conservons aucune donnée de carte bancaire ni aucun code de paiement : le règlement est traité par PayDunya, qui ne nous transmet pas ces informations.`,
          `Votre numéro de téléphone n'apparaît jamais publiquement. Il n'est communiqué à l'autre partie qu'une fois une réservation confirmée ou réglée entre vous.`,
          `Nous n'utilisons aucun traceur publicitaire et ne mesurons pas votre navigation à des fins commerciales. Votre navigateur conserve seulement ce qui est nécessaire à votre connexion et à vos préférences d'affichage.`,
        ],
      },
      {
        titre: '8. Vos droits',
        paragraphes: [
          `Vous disposez d'un droit d'accès, de rectification et de suppression de vos données, ainsi que du droit de vous opposer à leur traitement. La plupart de ces opérations se font directement depuis votre espace personnel.`,
          `Pour les autres, écrivez à ${CONTACT}. Nous répondons dans un délai d'un mois. Une demande de suppression est honorée sous réserve des données que nous devons conserver au titre de l'article 6.`,
          `Si notre réponse ne vous satisfait pas, vous pouvez saisir la Commission de protection des données personnelles (CDP) du Sénégal.`,
        ],
      },
      {
        titre: '9. Sécurité',
        paragraphes: [
          `Les mots de passe sont conservés sous forme chiffrée et ne sont lisibles par personne, pas même par nous. Les échanges avec la plateforme sont chiffrés.`,
          `Si un incident de sécurité venait à concerner vos données, vous en seriez informé.`,
        ],
      },
    ],
  },

  annulation: {
    cle: 'annulation',
    titre: 'Politique d\'annulation',
    description: `Conditions d'annulation et barème de remboursement de ${EXPLOITANT} : ce qui vous est rendu, selon la cause et le délai.`,
    miseAJour: MAJ,
    chapeau:
      `Cette page dit ce qui vous est remboursé quand un séjour n'a pas lieu, et sous quel délai. Elle fait partie intégrante des conditions générales.`,
    sections: [
      {
        titre: '1. Le principe',
        paragraphes: [
          `${EXPLOITANT} encaisse le prix du séjour et détient les fonds jusqu'au reversement au propriétaire. C'est donc ${EXPLOITANT} qui rembourse, et non le propriétaire.`,
          `Ce qui vous est rendu dépend de deux choses, et de deux seulement : qui est à l'origine de l'annulation, et combien de temps sépare la demande de la date d'arrivée.`,
        ],
      },
      {
        titre: '2. Quand l’annulation ne vient pas de vous',
        paragraphes: [
          `Lorsque l'annulation est imputable à ${EXPLOITANT} ou au propriétaire — logement indisponible, non conforme au point de rendre le séjour impossible, propriétaire injoignable, défaillance de notre service — la totalité des sommes réglées vous est rendue, commission comprise.`,
          `Vous n'avez pas à supporter une défaillance qui n'est pas la vôtre. Aucune retenue n'est appliquée dans ce cas, quel que soit le délai avant l'arrivée.`,
          `Les annulations répétées à l'initiative d'un propriétaire entraînent le retrait de ses annonces.`,
        ],
      },
      {
        titre: '3. Quand vous renoncez — le barème',
        paragraphes: [
          `Si vous renoncez à un séjour déjà réglé, le barème ci-dessous s'applique. Il porte sur la part revenant au propriétaire ; la commission de ${EXPLOITANT} reste acquise, la mise en relation ayant eu lieu et l'encaissement ayant occasionné des frais qui ne nous sont pas restitués.`,
        ],
        liste: [
          'Sept jours ou plus avant l’arrivée : la totalité de la part propriétaire vous est rendue.',
          'Entre deux et six jours avant l’arrivée : la moitié de cette part vous est rendue.',
          'Moins de 48 heures avant l’arrivée, ou absence le jour dit : aucun remboursement. Les dates étaient bloquées à votre nom et le propriétaire a refusé d’autres clients.',
          'Exemple : pour une réservation de 100 000 FCFA — dont 15 000 de commission et 85 000 pour le propriétaire — annulée par vos soins trois jours avant l’arrivée, la somme rendue est de 42 500 FCFA.',
        ],
      },
      {
        titre: '4. Tant que rien n’est réglé',
        paragraphes: [
          `Une demande de réservation qui n'a pas encore été réglée s'annule librement depuis votre espace, à tout moment et sans frais. Aucune somme n'ayant été versée, il n'y a rien à rembourser.`,
          `Il en va de même d'une demande restée sans réponse du propriétaire pendant 24 heures : elle s'annule d'elle-même.`,
        ],
      },
      {
        titre: '5. Comment demander l’annulation d’un séjour réglé',
        paragraphes: [
          `Une fois la réservation réglée, elle ne s'annule plus d'un clic. Depuis votre espace, le bouton « Demander l'annulation » enregistre votre demande, et vous êtes invité à en indiquer le motif.`,
          `Le motif n'est pas une formalité : c'est lui qui détermine la cause retenue, donc la somme rendue. Décrivez précisément ce qui empêche le séjour.`,
          `Jusqu'à notre décision, la réservation reste confirmée et les dates restent bloquées à votre nom. Nous ne les libérons pas avant d'avoir tranché, afin qu'un autre client ne réserve pas un séjour dont le sort n'est pas fixé.`,
        ],
      },
      {
        titre: '6. Circonstances exceptionnelles',
        paragraphes: [
          `En cas d'événement grave et imprévisible empêchant le séjour — catastrophe naturelle, décision administrative, urgence médicale justifiée — un remboursement intégral peut être accordé sur présentation d'un justificatif, sans application du barème de l'article 3.`,
        ],
      },
      {
        titre: '7. Comment et quand vous êtes remboursé',
        paragraphes: [
          `Le remboursement est effectué par ${EXPLOITANT} sur le numéro de téléphone qui a servi au paiement, par le même moyen — Wave ou Orange Money.`,
          `Il intervient au plus tard sous 15 jours ouvrés à compter de la décision. Si le numéro ayant servi au paiement n'est plus utilisable, prévenez-nous : nous conviendrons d'un autre moyen avant tout virement.`,
          `Une réservation annulée reste consultable dans votre espace, et sa messagerie reste ouverte : la conversation en garde la trace.`,
        ],
      },
      {
        titre: '8. Désaccord',
        paragraphes: [
          `Si notre décision ne vous paraît pas fondée, écrivez à ${CONTACT} en précisant le numéro de votre réservation. Nous réexaminons le dossier avec les deux parties et vous adressons une réponse motivée.`,
        ],
      },
    ],
  },

  vente: {
    cle: 'vente',
    titre: 'Conditions générales de vente',
    description: `Conditions de vente de la boutique ${EXPLOITANT} : commande, prix, livraison, paiement et retours des articles d'artisanat.`,
    miseAJour: MAJ,
    chapeau:
      `Ces conditions régissent les achats effectués dans la boutique d'artisanat. Elles sont distinctes des conditions générales d'utilisation, qui régissent la location de logements.`,
    sections: [
      {
        titre: '1. Le vendeur',
        paragraphes: [
          `Contrairement à la location, où ${EXPLOITANT} se borne à mettre en relation, la boutique est une activité de vente : ${EXPLOITANT} est le vendeur des articles proposés, et le contrat de vente est conclu directement entre vous et elle.`,
          `Les artisans dont le nom accompagne un article en sont les auteurs. Ils ne sont pas parties au contrat de vente et ne disposent pas de compte sur la plateforme.`,
        ],
      },
      {
        titre: '2. Les articles',
        paragraphes: [
          `Les articles sont fabriqués à la main. D'un exemplaire à l'autre, la teinte, la finition et les dimensions peuvent varier légèrement : c'est le propre du fait main, et non un défaut.`,
          `Les photographies rendent l'article aussi fidèlement que possible ; l'affichage d'un écran à l'autre peut faire varier les couleurs.`,
          `Certaines pièces sont uniques. Une fois vendues, elles ne sont pas réapprovisionnées.`,
        ],
      },
      {
        titre: '3. Commander',
        paragraphes: [
          `On commande un article à la fois : il n'y a pas de panier. Pour acheter plusieurs articles, passez plusieurs commandes.`,
          `L'exemplaire commandé quitte la vitrine dès la validation de votre commande, avant même le règlement, afin qu'un autre acheteur ne puisse pas le prendre pendant que vous payez.`,
          `Le prix, les frais de livraison et le total sont figés au moment de la commande. Une modification ultérieure de nos tarifs ne réécrit jamais une commande passée.`,
          `Pour les vêtements et chaussures, indiquez votre taille dans la note libre prévue à cet effet : la boutique ne gère pas de tailles séparées.`,
        ],
      },
      {
        titre: '4. Prix et livraison',
        paragraphes: [
          `Les prix sont affichés en francs CFA. Les frais de livraison dépendent de la zone et vous sont indiqués avant le paiement : votre total est connu avant que vous ne régliez quoi que ce soit.`,
        ],
        liste: [
          'Dakar et banlieue : 2 000 FCFA, sous 24 à 48 heures.',
          'Autres régions du Sénégal : 5 000 FCFA, sous 3 à 5 jours.',
          'Retrait sur place : gratuit, sur rendez-vous.',
          'Les délais annoncés courent à compter de la confirmation de la commande, et ne sont pas garantis : ils dépendent de l’acheminement.',
        ],
      },
      {
        titre: '5. Payer',
        paragraphes: [
          `Deux moyens sont possibles : le paiement en ligne par Wave ou Orange Money, via PayDunya ; ou le paiement à la livraison, en main propre au moment de la remise.`,
          `Une commande à régler à la livraison est valable dès sa validation, sans qu'aucune somme n'ait transité. Le refus répété de retirer une commande réglée à la livraison peut entraîner la suspension de cette facilité.`,
        ],
      },
      {
        titre: '6. Annuler, retourner',
        paragraphes: [
          `Tant que la commande n'a pas été expédiée, vous pouvez l'annuler en nous écrivant à ${CONTACT}. Si elle avait été réglée en ligne, la somme vous est rendue intégralement sous 15 jours ouvrés, sur le numéro ayant servi au paiement.`,
          `Après réception, vous disposez de sept jours pour nous informer que l'article ne vous convient pas, et de sept jours de plus pour nous le retourner. L'article doit revenir dans son état d'origine, non porté et non utilisé. Les frais de retour sont à votre charge, sauf lorsque l'article est non conforme à sa description ou abîmé, auquel cas nous les prenons en charge.`,
          `Le prix de l'article vous est alors rendu sous 15 jours ouvrés à compter de sa réception. Les frais de livraison initiaux restent acquis, sauf en cas de non-conformité.`,
        ],
      },
      {
        titre: '7. Article abîmé ou non conforme',
        paragraphes: [
          `Si l'article reçu est endommagé, ou ne correspond pas à sa description, écrivez-nous sous sept jours à ${CONTACT} en joignant une photographie. Nous procédons au remplacement lorsque c'est possible, ou au remboursement intégral, frais de livraison et de retour compris.`,
          `Les variations de teinte, de finition et de dimensions propres au fait main, mentionnées à l'article 2, ne constituent pas une non-conformité.`,
        ],
      },
      CONTACT_SECTION,
    ],
  },

  mentions: {
    cle: 'mentions',
    titre: 'Mentions légales',
    description: `Éditeur, directeur de la publication, hébergement et contact de la plateforme ${EXPLOITANT}.`,
    miseAJour: MAJ,
    chapeau: `Informations relatives à l'éditeur et à l'hébergement de la plateforme.`,
    sections: [
      {
        titre: 'Éditeur',
        paragraphes: [],
        liste: [
          `Dénomination : ${EXPLOITANT}`,
          'Forme juridique : en cours de formalisation',
          'Registre du commerce (RCCM) : en cours de formalisation',
          'NINEA : en cours de formalisation',
          'Siège : Dakar, Sénégal',
          `Directeur de la publication : ${DIRECTEUR}`,
          `Contact : ${CONTACT}`,
        ],
      },
      {
        titre: 'Hébergement et prestataires techniques',
        paragraphes: [
          `La plateforme s'appuie sur les prestataires suivants. Quatre d'entre eux sont établis aux États-Unis ; les conséquences de ce point pour vos données sont exposées dans la politique de confidentialité.`,
        ],
        liste: [
          'Application web : Render Services, Inc., 525 Brannan Street, Suite 300, San Francisco, CA 94107, États-Unis — render.com',
          'Interface applicative et base de données : Railway Corporation, 548 Market Street PMB 68956, San Francisco, CA 94104, États-Unis — railway.com',
          'Photographies des annonces : Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107, États-Unis — cloudflare.com',
          'Acheminement des courriels : Plus Five Five, Inc., 2261 Market Street #5039, San Francisco, CA 94114, États-Unis — resend.com',
          'Traitement des paiements : PayDunya, Dakar, Sénégal — paydunya.com',
        ],
      },
      {
        titre: 'Propriété intellectuelle',
        paragraphes: [
          `L'ensemble des éléments de la plateforme — marque, textes, interface, code — est protégé. Toute reproduction sans autorisation est interdite.`,
          `Les photographies des annonces demeurent la propriété de leurs auteurs, qui en autorisent la diffusion sur la plateforme.`,
        ],
      },
      {
        titre: 'Signalement',
        paragraphes: [
          `Pour signaler un contenu illicite, une annonce frauduleuse ou un abus, écrivez à ${CONTACT} en indiquant l'adresse de la page concernée. Chaque signalement est examiné et reçoit une réponse.`,
        ],
      },
    ],
  },
}
