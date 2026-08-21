# Prompt Claude Design — v3 : la couverture complète

_21 août 2026 · fait suite à `03-PROMPT-CLAUDE-DESIGN.md` (v1, en production) et
`07-PROMPT-CLAUDE-DESIGN-V2.md` (v2, en production)._

---

## Mode d'emploi

Le bloc entre les deux bandeaux est **autonome** : copiez-le tel quel dans le **projet
Claude Design existant** — `Design system et villas`,
`c2fcf305-e6f0-4ecf-8792-b5d297583351`. Pas dans un nouveau projet : les planches 01 à 09
y sont, et cette v3 les étend au lieu de repartir de zéro.

### Un avertissement sur le volume

Vous demandez **tous les écrans, en web et mobile, dans les deux thèmes**. L'inventaire
ci-dessous en compte **37**, soit **148 vues**. C'est trop pour une seule passe : la
qualité s'effondrerait vers la fin, et vous obtiendriez cent quarante-huit maquettes
moyennes plutôt que trente-sept bonnes.

Le prompt est donc découpé en **cinq lots**, dans l'ordre où ils rapportent. Envoyez le
préambule (sections A à D) **une fois**, puis un lot à la fois. Chaque lot est utilisable
seul : vous pouvez implémenter le lot 1 pendant que le lot 2 se dessine.

| Lot | Écrans | Pourquoi cet ordre |
|---|---|---|
| **1** | Boutique — 5 écrans | Le plus récent, le seul jamais passé par le design |
| **2** | Espace personnel — 9 écrans | Vu à chaque séjour, par les deux rôles |
| **3** | Parcours public — 12 écrans | Déjà designé en v1/v2 : reprise et mise à niveau |
| **4** | Administration — 11 écrans | Vu par vous seul, mais tous les jours |
| **5** | Superpositions et états | Ce qui traverse tous les écrans |

---

## ▼▼▼ DÉBUT DU PROMPT ▼▼▼

Tu as produit le design system de **Ma Villa** en deux passes : les planches 01 à 08
(tokens, carte de villa, accueil, recherche, fiche villa, bloc tarifaire) puis la planche 09
(châssis d'application, navigation basse, catégories, tunnel de paiement).

**Les deux sont implémentées et en production.** Ne les refais pas. Cette troisième passe
couvre ce que tu n'as jamais vu — et le produit a beaucoup grossi depuis.

Tout l'écrit reste en **français**.

---

### A. Ce qui est acquis et ne bouge pas

Implémenté, vérifié, en ligne. Reprends-le tel quel :

- **Palette WCAG AA.** `--accent #A34D1F` (5,3:1 sur fond clair), `--text-3 #726A62`,
  `--gold #8A6A12` en fond plein du badge Vedette, `--gold-soft #D4A843` réservé aux
  étoiles décoratives. Thème sombre complet, où `--accent` devient `#E8845A` et
  **`--on-accent` devient `#1A1614`** — du texte sombre sur l'accent, jamais du blanc.
- **Cormorant Garamond** en display, **DM Sans** en interface, échelle en `clamp()`.
- **Carte de villa en 4/3**, prix isolé sous un filet, chiffres tabulaires.
- **Bloc tarifaire à deux vues** : grille dans le corps de page, parcours guidé dans le
  panneau. Les formules impossibles sont **barrées, pas masquées**.
- **Une image en hero, jamais de vidéo.** Budget 180 Ko.
- **44 px minimum** pour tout contrôle tactile.
- **Un seul bouton primaire par écran**, dans l'accent, réservé à la conversion du parcours
  en cours. « Publier ma villa » reste secondaire sur les écrans destinés au client.
- **Navigation basse mobile** : Explorer · Recherche · Boutique · Réservations · Compte.
  Cinq onglets tiennent en 375 px (cellule 75 px). Elle **disparaît** dans les tunnels de
  paiement et de commande.

---

### B. Ce que le produit est devenu depuis la v2

Six changements, tous en production. Ils créent des écrans que tu n'as jamais dessinés.

#### B1. La plateforme encaisse, et reverse

Ma Villa **encaisse la totalité** du séjour par Wave ou Orange Money, retient **10 % en
dessous de 50 000 FCFA, 20 % au-delà**, puis reverse au propriétaire **après la fin du
séjour**. Entre les deux, elle détient les fonds.

Cela a créé deux écrans : **Revenus** côté propriétaire (ce qui lui est dû, à venir, versé)
et **Reversements** côté administration (la file d'attente, et l'enregistrement d'un
versement).

Trois états à représenter, et le second est le plus important à rendre lisible :

| État | Sens |
|---|---|
| **À venir** | encaissé, mais le séjour n'a pas eu lieu |
| **Dû** | séjour terminé, pas encore versé — *c'est ce sur quoi on agit* |
| **Versé** | parti, avec sa référence |

#### B2. Le numéro du propriétaire a disparu des fiches

Publié, il permettait de conclure hors plateforme. Il n'apparaît plus qu'une fois la
réservation **confirmée ou payée**. En remplacement, une **messagerie** rattachée à chaque
réservation : la réservation *est* la conversation.

Écran à dessiner : un **fil de discussion** avec bulles, séparateurs de jour, saisie en bas,
et une **pastille de non-lus** qui apparaît sur la navigation et sur les cartes de
réservation.

#### B3. Une boutique, et ce n'est pas ce qu'on croyait

Décidée comme « boutique d'œuvres d'art », le catalogue réel est de **l'artisanat** :
bracelets, sandales, chemises, bonnets, tam-tams, un tableau. Deux conséquences de forme :

- **Sept catégories** — Tableaux et peintures · Sculptures et instruments · Bijoux et
  montres · Vêtements · Coiffes et chapeaux · Sacs et chaussures · Tissus et décoration.
  Elles se présentent en **pastilles défilantes** avec leur compte.
- **Un stock.** Une toile est unique ; un bracelet existe en vingt-quatre exemplaires. La
  carte doit distinguer *dernière pièce*, *disponible*, *épuisé* — et un article **épuisé
  reste visible** : une galerie qui efface ce qu'elle a vendu perd la preuve qu'elle vend.

La commande se fait **à l'unité**, avec des **frais de livraison par zone** (Dakar 2 000,
régions 5 000, retrait gratuit) et un règlement **en ligne ou à la livraison**.

#### B4. Une console d'administration complète

Elle compte onze écrans, dont trois **sondes de diagnostic** — des pages qui interrogent un
prestataire et rendent un verdict en clair. Elles n'ont jamais été designées et ressemblent
aujourd'hui à des listes de clés/valeurs.

#### B5. Les textes légaux sont en réécriture

Les quatre pages portent une **note d'attente** signée d'un bandeau. Ce n'est pas un état
d'erreur : c'est un état normal qui durera des semaines, et il doit être digne.

#### B6. Un journal d'audit

Qui a validé, rejeté, supprimé, versé — et quand. C'est ce qu'on produit en cas de litige.

---

### C. Les contraintes, qui ne sont pas négociables

Elles viennent du marché et du terrain, pas d'un goût.

1. **La data est payée au volume au Sénégal.** Pas de WebGL, pas de bibliothèque
   d'animation, pas d'asset décoratif lourd. Toute profondeur est du CSS composé —
   `transform` et `opacity` seulement. Un graphique se dessine en SVG à la main : Chart.js
   coûte 70 Ko gzip pour trois courbes.
2. **Mobile d'abord, et « mobile » veut dire 375 px.** C'est la largeur de référence, pas
   une dégradation. Aucun débordement horizontal, jamais.
3. **Aucun effet ne porte d'information.** Retirer toutes les animations doit laisser un
   produit complet.
4. **Trois couches composées simultanées au maximum** par écran.
5. **Les tunnels restent nus** — paiement d'une réservation, commande d'un article. Chaque
   milliseconde entre un montant et sa validation est un abandon. Pas de pied de page, pas
   de navigation, un seul chemin.
6. **Cormorant dessine des chiffres elzéviriens par défaut.** Sans `lining-nums`, « 17 » se
   lit « I7 ». Obligatoire sur toute valeur chiffrée en fonte display — et il y a des
   montants partout.
7. **Le contraste tient dans les deux thèmes.** Un écran validé en clair n'est pas validé.

---

### D. Ce que j'attends de chaque écran

Pour **chacun**, quatre rendus : **web clair · web sombre · mobile clair · mobile sombre**.
Largeurs de référence : **1280 px** et **375 px**.

Et pour chacun, au-delà de l'état nominal, les **quatre états** qui font le vrai travail :

| État | Ce qu'il doit montrer |
|---|---|
| **Chargement** | des squelettes qui ont la forme du contenu attendu, pas un rond qui tourne |
| **Vide** | ce qu'il faut faire pour qu'il ne le soit plus — jamais un simple « aucun résultat » |
| **Erreur** | ce qui a échoué, et une sortie |
| **Plein** | avec des données longues : un nom de villa de soixante caractères, un montant à sept chiffres |

Dis, pour chaque écran, **quelle est la seule chose que l'utilisateur vient y faire**. Si
un écran n'a pas de réponse courte à cette question, dis-le : c'est un défaut de
conception, pas de maquette.

---

### E. Les écrans — l'inventaire complet

#### Lot 1 · Boutique (5)

| Écran | Ce qu'on y fait |
|---|---|
| Vitrine | parcourir, filtrer par catégorie, chercher |
| Fiche d'un article | comprendre ce que c'est, et décider |
| Commande | choisir la livraison, voir le total, valider |
| Suivi d'une commande | savoir où en est le colis, payer si ce n'est pas fait |
| Mes commandes | retrouver ce que j'ai acheté |

Le total de la commande est la pièce maîtresse : **il n'apparaît qu'une fois la zone
choisie**, et il doit se lire juste au-dessus du bouton. Des frais découverts après coup
sont la première cause d'abandon.

#### Lot 2 · Espace personnel (9)

Châssis (barre latérale bureau, tiroir mobile) · Accueil · Mes villas · Publier une villa ·
Gérer une villa · Réservations · **Conversation** · **Revenus** · Favoris · Profil.

Le châssis est **partagé avec l'administration** : ce que tu dessines ici sert aux deux.

« Publier une villa » est le formulaire le plus long du produit — villa, puis logements,
puis formules tarifaires. C'est là qu'un propriétaire abandonne.

#### Lot 3 · Parcours public (12)

Accueil · Recherche · Fiche villa · Tunnel de paiement · Confirmation · Connexion ·
Inscription · Mot de passe oublié · Réinitialisation · Email vérifié · Pages légales
(un gabarit, quatre contenus) · 404.

Les six premiers existent en v1/v2 : **reprends-les** en les haussant au niveau des
nouveaux, ne les réinvente pas. Les écrans d'authentification et la page 404 n'ont jamais
été traités.

#### Lot 4 · Administration (11)

Tableau de bord (chiffres et courbes) · Villas · Utilisateurs · Avis · Journal d'audit ·
**Reversements** · **Œuvres** · **Commandes** · et trois **sondes** : Encaissement,
Notifications, Déboursement.

Une sonde répond à une question binaire — *est-ce que ça marche ?* — et doit donner son
**verdict en premier**, en une phrase. Le détail technique vient après, pour comprendre,
pas pour conclure.

#### Lot 5 · Superpositions et états (ce qui traverse tout)

Navigation basse · tiroir mobile · modale (versement, édition d'un article) · feuille de
filtres · téléverseur de photos · toasts · invitation d'installation PWA · réglage des
notifications · bandeau de texte légal provisoire · pastille de non-lus.

---

### F. Ce que je ne veux pas

- Une refonte de la palette ou de la typographie. Elles sont validées et implémentées.
- Des maquettes qui ne montrent que l'état nominal.
- Du remplissage : « Lorem ipsum », des prix ronds, des noms occidentaux. Le catalogue est
  sénégalais, les montants sont en FCFA sans décimales, les noms sont sénégalais.
- Des écrans qui supposent une connexion rapide.

---

### G. Comment me le rendre

Une planche par écran, dans le fichier existant. Chaque planche porte :

1. le nom de l'écran et **la phrase** qui dit ce qu'on y fait ;
2. les quatre rendus (web/mobile × clair/sombre) ;
3. les états chargement, vide, erreur, plein ;
4. les **tokens employés**, nommés — pas des valeurs hexadécimales ;
5. ce que tu as changé par rapport à l'existant, et **pourquoi**.

Si un écran te paraît mal conçu, dis-le avant de le dessiner. Une belle maquette d'un
mauvais écran coûte plus cher qu'une remarque.

## ▲▲▲ FIN DU PROMPT ▲▲▲

---

## Ce que la mémoire du projet disait, et qui est faux aujourd'hui

À corriger dans `ma-villa-design-system` :

- « Reste : feuilles modales de filtres sur mobile » — **fait**,
  `src/components/recherche/FeuilleFiltres.tsx`.
- « Le tableau de bord et l'administration utilisent encore des styles inline » — **faux**,
  `src/styles/console.css` est le châssis partagé depuis le 18 août.

## Deux pièges vérifiés sur le terrain, à ne pas relâcher

1. **Les collisions de noms de classe.** `.tunnel-total` et `.commande-entete` ont été
   redéfinies par la feuille de la boutique, chargée après `index.css`. Les deux feuilles
   étaient valides ; c'est leur superposition qui mentait. Un audit est en place — toute
   classe définie dans deux feuilles doit être renommée.
2. **`#fff` sur un fond d'accent.** Vrai en thème clair, faux en sombre où l'accent devient
   un saumon clair : le contraste tombe vers 2,4:1. Employer `--on-accent`, toujours.
