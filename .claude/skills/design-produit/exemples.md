# Exemples

Des décisions à refaire, et des erreurs déjà payées. Chacune dit comment elle
a été trouvée : c'est souvent la partie la plus utile.

## Erreurs payées

| Ce qui s'est passé | Trouvé par | La règle qui en est sortie |
|---|---|---|
| La boutique proposait encore « Payer maintenant » après la fermeture du paiement ; un clic immobilisait une pièce unique | relecture après la bascule | fermer une bascule = relire tout ce qui la suppose |
| Les cinq écrans de la boutique redirigeaient vers l'accueil au premier rendu | **navigateur** | « pas encore chargé » n'est pas « fermé » |
| Les boutons de la boutique menaient à `/connexion`, qui n'existe pas (`/login`) | **navigateur** | cliquer chaque lien d'un parcours |
| `.commande-entete` redéfinie par une autre feuille : boutons d'en-tête cassés en production plusieurs jours | **navigateur** | `audit-collisions-css.py`, préfixes par domaine |
| `.bouton-icone { position: relative }` a déplacé la bascule de thème et tout l'écran de connexion | **capture d'écran** | `npm run verifier:css` |
| Blanc en dur sur `--danger` en sombre : 2,8 pour 1 sur le bouton d'une suppression | **mesure au navigateur** | `--on-danger` ; ESLint `blanc-sur-couleur` |
| « 17 » lu « I7 » sur le tableau de bord (chiffres de Cormorant) | **navigateur** | `lining-nums` sur toute valeur en fonte de titre |
| Les sept pastilles de catégorie ne filtraient rien : la redirection `/villas` perdait `?categorie=` | l'exploitant, au clic | une redirection recopie la requête |
| La fourchette de prix mélangeait une piscine à la journée et une villa entière | **navigateur** | comparer à formule et type égaux, sinon ne rien dire |
| Un brouillon de vrai propriétaire était invisible de l'administration | l'exploitant | chaque statut a un écran qui le liste |
| « Piscine seule », « Annonces vérifiées », « villas » pour tout le catalogue, et l'adresse promise privée, restés à l'écran des semaines après les décisions | relecture des vidéos (15/10) puis ESLint (30/10) | `passetemps/vocabulaire` ; dire vrai avant d'écrire |
| Le propriétaire n'apprenait jamais la mise en ligne de son annonce (seulement un refus) ; la fiche disait « Écrivez-lui depuis vos réservations » alors qu'on ne pouvait plus réserver ; Google lisait « paiement Wave ou Orange Money » sur un paiement fermé | relecture (15/10), corrigé le 30/10 | prévenir de chaque changement d'état qui le concerne, par e-mail ; un texte suit la bascule ; une description figée au build ne promet que ce qui reste vrai dans tous les états |
| Réserver depuis une fiche échouait dès qu'il fallait choisir un logement (`logement_id: 0`), latent tant que la réservation était fermée | tour complet en local (30/10) | éprouver le parcours **ouvert** même quand la production est fermée |

## Décisions à refaire

- **Montrer le net avant le prix.** À l'étape du tarif, le propriétaire lit
  « Vous toucherez … par réservation. La plateforme retient … » avant de fixer
  son prix : il découvre la commission au bon moment, pas après sa première
  réservation.
- **Dire qu'on ne sait pas.** Sous dix annonces comparables, aucune
  fourchette : « Trop peu d'annonces à … pour donner une fourchette fiable ».
  Jamais une médiane nationale entre Saly et Ziguinchor.
- **Un contact plutôt qu'un formulaire refusé.** Réservation suspendue : la
  fiche donne un humain à joindre, WhatsApp et e-mail **préremplis avec le nom
  de l'hébergement**.
- **Le brouillon prouvé.** « Brouillon enregistré » s'affiche : « enregistré »
  est alors un constat, pas une promesse.
- **Une question, un chiffre.** Le tableau de bord de l'administration mène
  par les fonds détenus pour les propriétaires, le seul nombre dont une
  anomalie est un problème immédiat.
