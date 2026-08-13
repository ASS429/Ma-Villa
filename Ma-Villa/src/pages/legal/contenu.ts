/**
 * Textes légaux — version relue par le juriste, intégrée le 12 août 2026.
 *
 * Source de vérité : docs/juridique/corriges/. Toute correction doit repartir
 * de ces fichiers, pas de ce module.
 *
 * ⚠️ Ces textes décrivent une plateforme qui n'encaisse aucun paiement.
 * L'ouverture du paiement en ligne (PayDunya, commission) et celle de la
 * boutique d'œuvres d'art appellent une seconde relecture : l'article
 * « Tarifs et paiement » et la politique d'annulation deviendront faux, et la
 * vente à distance — rétractation, livraison — n'est couverte nulle part ici.
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

const MAJ = '10 août 2026'
const EXPLOITANT = 'Ma Villa'
const CONTACT = 'contactsmavilla@gmail.com'

/**
 * Bandeau d'avertissement en tête des pages légales.
 *
 * Passé à false le 12 août 2026 : les textes relus sont intégrés et toutes les
 * mentions sont renseignées.
 *
 * ⚠️ À repasser à `true`, après relecture, avant d'ouvrir le paiement ou la
 * boutique : une clause fausse sur les remboursements est précisément ce qu'un
 * agrégateur de paiement examine à l'ouverture d'un compte marchand.
 */
export const TEXTES_PROVISOIRES = false

export const DOCUMENTS: Record<DocumentLegal['cle'], DocumentLegal> = {
  cgu: {
    cle: 'cgu',
    titre: 'Conditions générales d\'utilisation',
    description: 'Les règles d\'utilisation de la plateforme Ma Villa : rôles, réservations, paiements, obligations des clients et des propriétaires.',
    miseAJour: MAJ,
    chapeau:
      'Les présentes conditions régissent l\'utilisation de la plateforme Ma Villa. En créant un compte, vous les acceptez sans réserve.',
    sections: [
      {
        titre: '1. Objet et rôle de la plateforme',
        paragraphes: [
          `Ma Villa, exploitée par ${EXPLOITANT}, est une plateforme de mise en relation entre des propriétaires de villas et de logements de vacances situés au Sénégal et des clients souhaitant les louer.`,
          'Ma Villa agit exclusivement en qualité d\'intermédiaire technique. Elle n\'est ni propriétaire, ni gestionnaire, ni loueur des biens présentés. Le contrat de location est conclu directement entre le client et le propriétaire.',
          'Ma Villa ne saurait être tenue responsable de l\'état réel du bien, de sa conformité à l\'annonce, ni de l\'exécution du séjour.',
        ],
      },
      {
        titre: '2. Comptes utilisateurs',
        paragraphes: [
          'L\'inscription est gratuite. Trois rôles existent : client, propriétaire, administrateur.',
          'L\'utilisateur s\'engage à fournir des informations exactes et à maintenir la confidentialité de ses identifiants. Toute activité réalisée depuis son compte lui est imputable.',
          'Ma Villa peut suspendre ou supprimer un compte en cas de manquement aux présentes conditions, notamment en cas d\'annonce mensongère, d\'avis frauduleux ou de comportement abusif.',
        ],
      },
      {
        titre: '3. Publication d\'une annonce',
        paragraphes: [
          'Le propriétaire garantit qu\'il détient les droits nécessaires pour louer le bien publié et que les informations diffusées (description, photographies, tarifs, capacité, localisation) sont exactes et à jour.',
          'Toute annonce est soumise à validation par l\'équipe Ma Villa avant sa mise en ligne. Une annonce peut être rejetée ou retirée sans préavis si elle est incomplète, trompeuse ou contraire à la loi.',
          'Le propriétaire est seul responsable du respect de ses obligations légales et fiscales liées à l\'activité de location.',
        ],
      },
      {
        titre: '4. Réservations',
        paragraphes: [
          'Une demande de réservation précise le logement, la formule tarifaire, les dates et le nombre de personnes. Elle n\'engage définitivement les parties qu\'après confirmation par le propriétaire.',
          'Le propriétaire s\'engage à répondre dans un délai raisonnable. Une demande sans réponse ne vaut pas acceptation.',
          'Le nombre de personnes déclaré ne peut excéder la capacité du logement. Tout dépassement autorise le propriétaire à refuser l\'accès.',
        ],
      },
      {
        titre: '5. Tarifs et paiement',
        paragraphes: [
          'Les tarifs sont fixés librement par les propriétaires et affichés en francs CFA (FCFA), toutes taxes comprises lorsque celles-ci sont applicables.',
          'À ce jour, aucun paiement n\'est encaissé par la plateforme : le règlement s\'effectue directement entre le client et le propriétaire, selon les modalités convenues entre eux. Ma Villa n\'intervient ni dans la transaction, ni dans sa sécurisation.',
          'Un paiement en ligne par Wave et Orange Money sera introduit ultérieurement. Les présentes conditions seront alors mises à jour et les utilisateurs informés avant son entrée en vigueur.',
          'Ma Villa n\'a accès à aucune donnée bancaire ni à aucun code secret.',
        ],
      },
      {
        titre: '6. Avis',
        paragraphes: [
          'Seul un client ayant effectué un séjour confirmé et terminé dans la villa concernée peut déposer un avis. Un avis par client et par villa.',
          'Les avis engagent leur auteur. Ma Villa se réserve le droit de retirer tout avis injurieux, diffamatoire, hors sujet ou manifestement frauduleux.',
        ],
      },
      {
        titre: '7. Responsabilité',
        paragraphes: [
          'Ma Villa met en œuvre les moyens raisonnables pour assurer la disponibilité et la sécurité de la plateforme, sans garantie d\'absence d\'interruption ou d\'erreur.',
          'La responsabilité de Ma Villa ne peut être engagée en cas de litige entre un client et un propriétaire, de dommage survenu pendant un séjour, ou d\'inexécution imputable à l\'une des parties.',
        ],
      },
      {
        titre: '8. Propriété intellectuelle',
        paragraphes: [
          'La marque, le nom de domaine, la charte graphique et les développements de la plateforme sont la propriété exclusive de son exploitant.',
          'En publiant des photographies, le propriétaire concède à Ma Villa une licence gratuite et non exclusive d\'utilisation à des fins de promotion de son annonce et de la plateforme.',
        ],
      },
      {
        titre: '9. Modification et droit applicable',
        paragraphes: [
          'Ma Villa peut modifier les présentes conditions à tout moment. La version applicable est celle en vigueur à la date d\'utilisation du service.',
          'Les présentes conditions sont soumises au droit sénégalais. À défaut de règlement amiable, tout litige relève de la compétence des juridictions de Dakar.',
        ],
      },
    ],
  },

  confidentialite: {
    cle: 'confidentialite',
    titre: 'Politique de confidentialité',
    description: 'Quelles données Ma Villa collecte, pourquoi, combien de temps elle les conserve, et comment exercer vos droits.',
    miseAJour: MAJ,
    chapeau:
      'Cette politique explique quelles données personnelles nous traitons, à quelles fins, et quels sont vos droits.',
    sections: [
      {
        titre: '1. Responsable du traitement',
        paragraphes: [
          `Le responsable du traitement est ${EXPLOITANT}. Pour toute question relative à vos données : ${CONTACT}.`,
          'Les traitements sont réalisés conformément à la loi n° 2008-12 du 25 janvier 2008 sur la protection des données à caractère personnel.',
        ],
      },
      {
        titre: '2. Données collectées',
        paragraphes: ['Nous collectons uniquement les données nécessaires au fonctionnement du service :'],
        liste: [
          'Compte : nom, adresse email, mot de passe (stocké sous forme chiffrée, jamais en clair), numéro de téléphone, rôle.',
          'Annonces : informations sur le bien, adresse, coordonnées GPS, photographies, tarifs.',
          'Réservations : dates de séjour, nombre de personnes, montant, statut.',
          'Avis : note et commentaire, associés à votre compte.',
          'Données techniques : adresse IP et journaux de connexion, à des fins de sécurité.',
        ],
      },
      {
        titre: '3. Finalités et bases légales',
        paragraphes: ['Vos données sont traitées pour :'],
        liste: [
          'Exécuter le service : créer un compte, publier une annonce, gérer une réservation (exécution du contrat).',
          'Vous informer : emails de confirmation, d\'annulation, de réinitialisation de mot de passe (exécution du contrat).',
          'Assurer la sécurité de la plateforme et prévenir la fraude (intérêt légitime).',
          'Respecter nos obligations légales et comptables.',
        ],
      },
      {
        titre: '4. Partage des données',
        paragraphes: [
          'Lorsqu\'une réservation est confirmée, le propriétaire reçoit le nom et les coordonnées du client, et réciproquement : cet échange est nécessaire à la réalisation du séjour.',
          'Vos données peuvent être transmises à nos prestataires techniques (hébergement, envoi d\'emails, paiement mobile), dans la stricte limite de ce qui est nécessaire à leur mission.',
          'Nous ne vendons ni ne louons vos données à des tiers.',
        ],
      },
      {
        titre: '5. Durée de conservation',
        paragraphes: [],
        liste: [
          'Compte actif : pendant toute la durée de vie du compte.',
          'Compte supprimé : suppression sous 30 jours, à l\'exception des données à conserver pour des raisons légales ou comptables.',
          'Réservations : 5 ans à compter de la fin du séjour, à des fins probatoires et comptables.',
          'Journaux de connexion : 12 mois.',
        ],
      },
      {
        titre: '6. Vos droits',
        paragraphes: [
          `Vous disposez d'un droit d'accès, de rectification, d'opposition, d'effacement et de portabilité de vos données. Pour l'exercer, écrivez à ${CONTACT} : nous répondons sous 30 jours.`,
          'Vous pouvez également saisir la Commission de protection des données personnelles (CDP) du Sénégal.',
        ],
      },
      {
        titre: '7. Sécurité et cookies',
        paragraphes: [
          'Les mots de passe sont chiffrés. Les échanges avec la plateforme sont protégés par HTTPS. L\'accès aux données est limité aux personnes qui en ont besoin.',
          'Ma Villa n\'utilise pas de cookies publicitaires ni de traceurs tiers. Seul un stockage local technique est utilisé pour maintenir votre session et mémoriser votre préférence de thème.',
        ],
      },
    ],
  },

  annulation: {
    cle: 'annulation',
    titre: 'Politique d\'annulation',
    description: 'Conditions d\'annulation d\'une réservation sur Ma Villa, côté client et côté propriétaire.',
    miseAJour: MAJ,
    chapeau:
      'Les règles ci-dessous s\'appliquent à défaut de conditions particulières précisées par le propriétaire dans son annonce. La plateforme n\'encaissant aucun paiement à ce jour, les remboursements éventuels relèvent d\'un accord direct entre le client et le propriétaire.',
    sections: [
      {
        titre: '1. Annulation par le client',
        paragraphes: ['Le client peut annuler depuis son espace, à tout moment avant le début du séjour. Le barème ci-dessous sert de référence aux sommes éventuellement versées au propriétaire.'],
        liste: [
          'Demande encore en attente de confirmation : annulation libre, sans frais.',
          'Réservation confirmée, plus de 7 jours avant l\'arrivée : remboursement intégral des sommes versées.',
          'Réservation confirmée, entre 7 et 2 jours avant l\'arrivée : remboursement de 50 %.',
          'Moins de 48 heures avant l\'arrivée, ou non-présentation : aucun remboursement.',
        ],
      },
      {
        titre: '2. Annulation par le propriétaire',
        paragraphes: [
          'Un propriétaire qui annule une réservation confirmée doit en informer le client sans délai. Les sommes versées sont intégralement remboursées au client.',
          'Les annulations répétées à l\'initiative d\'un propriétaire peuvent entraîner le retrait de ses annonces.',
        ],
      },
      {
        titre: '3. Circonstances exceptionnelles',
        paragraphes: [
          'En cas d\'événement grave et imprévisible empêchant le séjour (catastrophe naturelle, décision administrative, urgence médicale justifiée), un remboursement intégral peut être accordé sur présentation d\'un justificatif.',
        ],
      },
      {
        titre: '4. Modalités de remboursement',
        paragraphes: [
          'Tant que la plateforme n\'encaisse aucun paiement, le remboursement est effectué par le propriétaire, selon les modalités convenues lors du règlement.',
          'Lorsque le paiement en ligne sera mis en service, les remboursements seront effectués sur le moyen de paiement d\'origine sous 14 jours ouvrés à compter de la validation de l\'annulation.',
        ],
      },
      {
        titre: '5. Litiges',
        paragraphes: [
          `En cas de désaccord, contactez-nous à ${CONTACT} en précisant le numéro de réservation. Nous instruisons le dossier avec les deux parties.`,
        ],
      },
    ],
  },

  mentions: {
    cle: 'mentions',
    titre: 'Mentions légales',
    description: 'Éditeur, hébergeur et contact de la plateforme Ma Villa.',
    miseAJour: MAJ,
    chapeau: 'Informations relatives à l\'éditeur et à l\'hébergement de la plateforme.',
    sections: [
      {
        titre: 'Éditeur',
        paragraphes: [],
        liste: [
          `Dénomination : ${EXPLOITANT}`,
          'Forme juridique : projet en cours de formalisation',
          'Registre du commerce (RCCM) : non encore attribué',
          'NINEA : non encore attribué',
          'Siège social : Mbour, Sénégal',
          'Directeur de la publication : Abdou Ndour',
          `Contact : ${CONTACT}`,
        ],
      },
      {
        titre: 'Hébergement',
        paragraphes: [],
        liste: [
          'Application web : Render Services, Inc. — San Francisco, Californie, États-Unis',
          'API et base de données : Railway Corp. — San Francisco, Californie, États-Unis',
          'Photographies : Cloudflare R2 — Cloudflare, Inc., San Francisco, Californie, États-Unis',
        ],
      },
      {
        titre: 'Propriété intellectuelle',
        paragraphes: [
          'L\'ensemble des éléments de la plateforme (marque, textes, interface, code) est protégé. Toute reproduction sans autorisation est interdite.',
          'Les photographies des annonces demeurent la propriété de leurs auteurs, qui en autorisent la diffusion sur la plateforme.',
        ],
      },
      {
        titre: 'Signalement',
        paragraphes: [
          `Pour signaler un contenu illicite ou une annonce frauduleuse, écrivez à ${CONTACT} en indiquant l'adresse de la page concernée.`,
        ],
      },
    ],
  },
}
