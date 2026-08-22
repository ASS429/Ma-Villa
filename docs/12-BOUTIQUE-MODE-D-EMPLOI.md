# La boutique — comment elle marche, et comment vous la gérez

_Écrit pour être lu sans connaître le code. État au 22 août 2026._

---

## 1. Le principe, en trois phrases

**Vous êtes le seul vendeur.** Il n'y a pas de comptes « artisan » : l'artisan est une
information portée par l'article, comme sa technique ou ses dimensions. L'argent d'une vente
vous revient donc **entièrement** — pas de commission, pas de reversement, à la différence
des villas.

**On commande un article à la fois.** Pas de panier.

**Le client connaît son total avant de payer.** Les frais de livraison sont annoncés par
zone, et le total n'apparaît qu'une fois la zone choisie.

---

## 2. Ce qu'est un article

Chaque article porte :

| Champ | À quoi il sert |
|---|---|
| **Titre** et **artisan** | ce que le client lit en premier |
| **Catégorie** | l'une des sept, elle sert à ranger et à filtrer |
| **Prix** | en FCFA, sans décimales |
| **Stock** | le nombre d'exemplaires |
| **Technique**, **dimensions**, **année** | le « cartel », comme en galerie |
| **Description** | le texte long |
| **Photos** | cinq au maximum |
| **Coup de cœur** | remonte l'article en tête de vitrine |

### Les sept catégories

Tableaux et peintures · Sculptures et instruments · Bijoux et montres · Vêtements · Coiffes
et chapeaux · Sacs et chaussures · Tissus et décoration.

Elles apparaissent en pastilles au-dessus de la boutique, **avec le nombre d'articles de
chacune**. Une catégorie vide n'est jamais proposée : un filtre qui ne rend rien use la
confiance plus vite qu'il ne rend service.

### Le stock — le point à bien comprendre

C'est ce qui distingue une pièce unique d'une série.

- **Stock à 1** — un tableau, un tam-tam. Commander le retire de la vente.
- **Stock à 24** — des bracelets. Commander en retire un exemplaire, il en reste 23.

La carte le dit au client : **« Dernière pièce »** quand il n'en reste qu'un, **« Épuisé »**
quand il n'en reste plus. Et la fiche adapte son texte : « Pièce unique, vendue une seule
fois » pour un tableau, « Fait main — deux exemplaires ne sont jamais identiques » pour une
série.

⚠️ **Un article épuisé reste visible en boutique**, en fin de liste et en retrait. C'est
délibéré : une galerie qui efface ce qu'elle a vendu perd la preuve qu'elle vend.

### Les trois états

| État | Ce que ça veut dire |
|---|---|
| **Brouillon** | invisible partout. C'est là qu'un article naît |
| **En vente** | visible et achetable |
| **Vendu** | visible, plus achetable. Posé automatiquement quand le stock tombe à zéro |

---

## 3. Comment un client achète

1. Il parcourt la boutique, filtre par catégorie ou cherche.
2. Il ouvre une fiche : photos, cartel, prix, disponibilité.
3. Il clique « Commander » — **un compte est demandé ici**, pas avant. On peut tout regarder
   sans compte.
4. Il choisit **où livrer** : Dakar (2 000 FCFA), régions (5 000), ou retrait sur place
   (gratuit). Les trois tarifs sont visibles avant de choisir.
5. **Le total apparaît alors seulement.** Tant qu'aucune zone n'est choisie, il n'y a pas de
   total — un total qui augmente après coup est la première cause d'abandon.
6. Il saisit destinataire, téléphone, adresse, ville.
7. Il choisit **de payer maintenant** (Wave ou Orange Money) **ou à la livraison**.
8. Il valide.

**Dès la validation, l'exemplaire quitte le stock** — avant même le paiement. C'est voulu :
attendre le règlement laisserait une fenêtre pendant laquelle un second acheteur pourrait
prendre le même article.

---

## 4. Votre console — l'écran « Articles »

C'est là que vous gérez le catalogue. Entrée **« Articles »** dans le menu de gauche.

### Ce que vous y voyez

La liste de tous les articles, brouillons compris, avec pour chacun sa photo, son titre,
son artisan, son prix, **son stock** et son état. Quatre onglets : Toutes · En vente ·
Brouillons · Vendues.

### Créer un article

Bouton « Nouvel article » en haut à droite. Vous remplissez le formulaire, vous validez —
et l'écran **enchaîne directement sur l'ajout de photos**, parce qu'un article sans photo
ne se vend pas.

Un article naît toujours en **brouillon**. Il n'apparaît nulle part tant que vous ne l'avez
pas passé « En vente ».

### Les photos

Cinq au maximum. Le compteur vous dit où vous en êtes : « 3 sur 5 · il en reste 2 ».

**Les photos lourdes sont réduites automatiquement** avant l'envoi. Une photo de téléphone
de 12 Mo part à moins de 700 Ko, redimensionnée à 1600 px. Vous n'avez rien à faire — et
surtout, vous ne payez pas l'envoi de 12 Mo pour vous les faire refuser.

**La première photo est la vignette** affichée partout. Elle est marquée comme telle.

### Modifier un article

Cliquez sur sa ligne. Tout est modifiable.

⚠️ **Deux règles à connaître :**

- **Changer le prix ne réécrit pas les ventes passées.** Le prix est figé au moment de la
  commande. Une commande d'hier garde son prix d'hier.
- **Un article épuisé se remet en vente en lui redonnant du stock.** Il repasse « en vente »
  tout seul — pas besoin de changer aussi l'état. En revanche, le passer « en vente » sans
  stock est refusé : rien ne serait livrable.

### Supprimer un article

Possible **seulement s'il n'a jamais été commandé**. Sinon, l'écran vous le dit et vous
propose de le repasser en brouillon pour le retirer de la vitrine — supprimer emporterait
la trace comptable d'une vente.

---

## 5. Votre console — l'écran « Commandes »

Entrée **« Commandes »** dans le menu. C'est votre file de travail.

### Ce que vous y voyez

Chaque commande porte : la photo et le titre de l'article, sa référence, **l'acheteur avec
son téléphone**, l'adresse de livraison, le mode de règlement, et le montant.

Cinq onglets : Toutes · À expédier · En route · En attente · Livrées.

### Le cycle d'une commande

| État | Ce qui s'est passé | Votre action |
|---|---|---|
| **En attente** | commande passée, paiement en ligne non abouti | Confirmer |
| **Confirmée** | payée en ligne, ou à régler à la livraison | Marquer expédiée |
| **Expédiée** | partie chez le client | Marquer livrée |
| **Livrée** | terminée | — |
| **Annulée** | l'exemplaire est retourné au stock | — |

**Un seul bouton par ligne**, jamais un menu : l'étape suivante et rien d'autre. « Annuler »
est toujours disponible tant que la commande n'est pas livrée.

### Le point qui compte : « Marquer livrée » encaisse

Pour une commande **payable à la livraison**, marquer la commande livrée la **solde
automatiquement** : c'est le moment où l'argent change de mains, et il n'y en a pas d'autre.
L'écran vous le confirme — « Livrée et réglée — 47 000 FCFA encaissés. »

Pour une commande payée en ligne, l'argent est déjà arrivé ; « livrée » ne fait que clore.

### Ce qui doit vous sauter aux yeux

Une commande **non réglée** porte la mention « non réglé » en ambre à la ligne
« Règlement ». C'est ce qui décide si vous expédiez ou pas.

### Annuler

Annuler une commande **rend l'exemplaire au stock** et remet l'article en vente s'il était
épuisé. Sans cela, une commande abandonnée immobiliserait l'article pour toujours.

---

## 6. Ce que le client voit de son côté

Depuis « Mes commandes », il retrouve chaque achat avec un **fil d'étapes** — Confirmée,
Expédiée, Livrée — et peut **payer celle qui ne l'est pas** s'il avait choisi le paiement en
ligne sans aller au bout.

Il peut annuler lui-même tant que rien n'est parti et que rien n'est payé. Au-delà, l'écran
lui dit de vous contacter.

---

## 7. Ouvrir et fermer la boutique

La boutique est pilotée par une seule variable sur Railway : `BOUTIQUE_ACTIVE`.

- **À `false`** : la boutique n'existe nulle part. Pas de lien dans le menu, pas d'onglet
  dans la barre du bas, et les adresses répondent « page introuvable » — pas « revenez plus
  tard », qui inviterait les moteurs de recherche à garder l'adresse.
- **À `true`** : tout apparaît.

Elle est **actuellement ouverte**, avec dix-neuf articles de démonstration.

⚠️ **Les prix et les noms d'artisans sont inventés.** Quand vous saisirez votre vrai
catalogue, supprimez d'abord les articles fictifs — sinon ils cohabiteront avec les vôtres.
Le peuplement automatique, lui, ne reviendra pas : il ne s'exécute que sur une boutique
vide.

---

## 8. Réglages, si vous voulez les changer

Tous sur Railway, sans redéploiement :

| Variable | Ce qu'elle règle | Valeur |
|---|---|---|
| `BOUTIQUE_ACTIVE` | la boutique existe ou non | `true` |
| `LIVRAISON_DAKAR` | frais Dakar et banlieue | 2 000 |
| `LIVRAISON_REGIONS` | frais autres régions | 5 000 |
| `BOUTIQUE_PAIEMENT_LIVRAISON` | propose-t-on le paiement à la livraison | `true` |
| `ANNONCE_PHOTOS_MAX` | plafond de photos | 5 |

Le retrait sur place est toujours gratuit.

---

## 9. Ce qui n'existe pas encore

- **Pas de suivi de livraison** : le design propose d'afficher le nom et le numéro du
  coursier plutôt qu'un code de suivi. Non construit.
- **Pas de remboursement automatique.** Une commande payée en ligne puis annulée se
  rembourse à la main — comme les reversements aux propriétaires, tant que PayDunya n'a pas
  ouvert l'option de déboursement.
- **Pas de gestion de tailles** pour les vêtements et les chaussures. Le client précise sa
  taille dans la note de commande, et vous lui écrivez si besoin.
- **Les textes légaux ne couvrent pas la vente à distance** — rétractation, livraison,
  retour d'un article. Votre note au juriste le signale déjà. **À régler avant d'ouvrir
  commercialement la boutique**, pas après.
