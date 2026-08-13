# Prompt Claude Design — v2 : de la place de marché à l'application

_12 août 2026 · fait suite à `03-PROMPT-CLAUDE-DESIGN.md`, dont le résultat est en production._

**Mode d'emploi.** Le bloc ci-dessous est autonome. Copiez-le dans **le projet Claude Design
existant** (`Design system et villas`, `c2fcf305-e6f0-4ecf-8792-b5d297583351`) plutôt que dans
un nouveau : la v1 y est, et cette v2 s'appuie dessus au lieu de repartir de zéro.

---

## ▼▼▼ DÉBUT DU PROMPT ▼▼▼

Tu as déjà produit le design system de **Ma Villa** (planches 01 à 08, tokens, carte de villa,
accueil, recherche, fiche villa, bloc tarifaire). **Il est implémenté et en production.** Ne le
refais pas : cette étape l'étend et hausse son niveau d'exigence.

Tout l'écrit reste en français.

---

### A. Ce qui est déjà en place, et qui ne bouge pas

Ces choix ont été implémentés et vérifiés. Reprends-les tels quels :

- **Palette WCAG AA** : `--accent #A34D1F` (5,3:1), `--text-3 #726A62`, `--gold #8A6A12` en
  fond plein, `--gold-soft #D4A843` réservé aux étoiles décoratives. Thème sombre complet.
- **Cormorant Garamond** en display, **DM Sans** en interface, échelle en `clamp()`.
- **Carte de villa en 4/3**, prix isolé sous un filet en chiffres tabulaires.
- **Bloc tarifaire à deux vues** : la grille dans le corps de page, le parcours guidé dans le
  panneau. Les formules impossibles sont barrées, pas masquées.
- **Une image en hero, jamais de vidéo** — budget 180 Ko.
- **44 px minimum** pour tout contrôle tactile.
- **Un seul bouton primaire**, dans la couleur d'accent, réservé à la conversion du parcours
  en cours.

---

### B. Ce qui change — quatre décisions

#### B1. La recherche commence par la **catégorie**, plus par le lieu

C'est une inversion, pas un ajustement. Aujourd'hui on demande « Où allez-vous ? » puis on
filtre. Désormais : **« Que cherchez-vous ? » d'abord**, l'emplacement ensuite.

Les catégories : **villa**, **appartement**, **studio meublé**, **chambre**, **piscine
seule** — et la liste doit pouvoir s'allonger sans refonte.

Pourquoi c'est juste : quelqu'un qui cherche un studio meublé au mois et quelqu'un qui cherche
une piscine pour un après-midi n'ont ni le même budget, ni la même unité de temps, ni les
mêmes critères. Les mélanger dans une seule liste triée par ville force chacun à écarter
l'offre de l'autre.

**À dessiner :**
- L'écran d'entrée : le choix de catégorie comme premier geste, sur l'accueil et en tête de
  recherche. Grandes cibles, illustrées, immédiatement lisibles — c'est le geste le plus
  important du produit.
- Comment la catégorie choisie **reconfigure la suite** : les filtres d'une villa (capacité,
  piscine, nuits) ne sont pas ceux d'un studio meublé (durée au mois, meublé/équipé), ni ceux
  d'une piscine à la journée (créneau horaire, nombre d'invités).
- Le retour en arrière : changer de catégorie sans reperdre sa destination et ses dates.
- L'état où une catégorie n'a encore aucune offre dans la ville demandée.

#### B2. Le paiement en ligne — décidé et à intégrer

**PayDunya SoftPay**, moyens **Wave** et **Orange Money**. Le client règle au moment de valider
sa réservation. La plateforme prélève une commission.

Ce n'est plus « bientôt disponible » : c'est le cœur de la transaction, et l'écran qui décide
si la plateforme gagne sa vie ou reste un annuaire.

**À dessiner :**
- Le **récapitulatif avant paiement** : montant du séjour, commission si elle est visible du
  client, total. Aucune surprise entre l'annonce et le débit.
- Le **choix du moyen** : Wave et Orange Money, à parité, avec leurs marques. Sur ce marché,
  le logo est l'élément qui rassure.
- Le **temps d'attente** : un paiement mobile money passe par une confirmation sur le
  téléphone du client. Cet écran d'attente dure parfois une minute. Il doit occuper cette
  minute, expliquer ce qui se passe, et ne jamais laisser croire que c'est planté.
- **L'échec** : solde insuffisant, délai dépassé, refus de l'opérateur. Trois causes, trois
  messages distincts, et une sortie dans chaque cas.
- La **confirmation** : ce que le client doit faire ensuite, et le contact du propriétaire.
- Côté propriétaire : ce qu'il **touche réellement**, commission déduite, et quand.

#### B3. Une boutique d'œuvres d'art

Nouveau domaine dans la même plateforme : vente d'**œuvres d'art**, paiement Wave, Orange
Money, **ou à la livraison**.

Attention — c'est un second métier greffé sur le premier. Un séjour se réserve, une œuvre
s'achète et se livre. Le risque est de fabriquer une place de marché à deux têtes où
l'utilisateur ne sait plus où il est.

**À dessiner, et à trancher :** la boutique est-elle un onglet de même rang que les
locations, ou un univers distinct dans lequel on entre ? **Propose ta réponse et argumente-la.**

Puis : la grille des œuvres (une œuvre est une pièce unique — pas de stock, pas de taille),
la fiche d'une œuvre, le panier, le choix de livraison, et le **paiement à la livraison**, qui
n'a pas le même écran de confirmation qu'un paiement en ligne puisque rien n'est encaissé.

#### B4. Cela doit ressembler à une application, pas à un site web

L'exigence est explicite : sur mobile, la plateforme doit donner l'impression d'avoir été
**téléchargée depuis l'App Store ou le Play Store**. Moderne, animée, avec des **effets 3D et
cinématiques**. Et en même temps : **très simple d'usage**.

Ces deux exigences se contredisent si on les prend à la lettre. Tranche-les ainsi :
l'ambition visuelle sert la lisibilité et le plaisir, jamais au prix d'un geste supplémentaire
ou d'une seconde d'attente.

**Ce qui fait qu'une interface web « fait application » :**
- Une **navigation basse fixe** — le pouce vit en bas de l'écran, pas en haut.
- Des **transitions d'écran orientées** : on entre dans une fiche, on en ressort. La direction
  du mouvement raconte la hiérarchie.
- Des **feuilles modales** qui montent, s'attrapent et se referment d'un geste.
- Une **réponse immédiate au toucher** : rien ne doit sembler différé.
- Des **squelettes** plutôt que des tourniquets.
- Une **icône sur l'écran d'accueil** et un lancement plein écran, sans barre d'adresse.

**Où placer la 3D et le cinématique — et où ne pas en mettre :**
- **Oui** sur le hero d'accueil, sur l'entrée dans une fiche villa, sur la confirmation d'une
  réservation réussie. Ce sont des moments, ils méritent une mise en scène.
- **Non** dans les listes, les formulaires, les tableaux de bord et le tunnel de paiement.
  Un effet qui retarde un prix ou un bouton de paiement est un défaut, pas une qualité.

**Contrainte non négociable :** le marché est mobile, sur data payée au volume et sur des
appareils modestes. Toute intention visuelle doit tenir dans un budget — indique-le pour
chacune, et propose systématiquement une **version dégradée** pour `prefers-reduced-motion`,
le mode économiseur de données et les appareils lents. Une animation qu'on ne peut pas
dégrader n'entre pas dans le produit.

---

### C. Les écrans à produire

**Priorité 1 — ce qui change le parcours**
1. Accueil mobile et desktop, refondus autour du **choix de catégorie**.
2. La recherche par catégorie, avec ses filtres qui changent selon la catégorie.
3. Le tunnel de paiement complet : récapitulatif → choix du moyen → attente → succès → chacun
   des trois échecs.

**Priorité 2 — l'impression d'application**
4. La **navigation basse** mobile, et ce qu'elle contient.
5. Le **vocabulaire de mouvement** : entrée et sortie d'écran, ouverture de feuille, retour
   au toucher, apparition d'une liste. Une planche qui les nomme et les spécifie en durées et
   en courbes, pour qu'ils soient réutilisables plutôt que réinventés à chaque écran.
6. Le hero d'accueil avec son parti pris 3D ou cinématique, **avec son budget et sa version
   dégradée**.

**Priorité 3 — la boutique**
7. L'entrée dans la boutique, et ta réponse argumentée sur son rang dans la navigation.
8. Grille des œuvres, fiche d'une œuvre, panier, livraison, paiement à la livraison.

**Priorité 4 — la dette connue**
9. Le tableau de bord propriétaire et l'administration : ils n'ont jamais reçu le système et
   utilisent encore des styles écrits à la main. Le propriétaire y publie ses annonces et
   répond aux demandes — c'est là qu'il décide de rester ou de partir.

---

### D. Ce que j'attends

1. Les **tokens ajoutés** par cette étape — profondeur, courbes, durées — dans la continuité
   des existants, sans les casser.
2. Les écrans du §C, **mobile d'abord**.
3. Pour chaque décision structurante — l'ordre catégorie/lieu, le rang de la boutique, chaque
   effet 3D — **deux ou trois phrases de raisonnement**. Je dois pouvoir défendre ces choix,
   pas seulement les appliquer.
4. Pour chaque animation : **son budget, son intention, et sa version dégradée**.
5. **Dis-moi ce qui te paraît faux dans ce brief.** L'exigence « application native » et
   l'exigence « très simple » peuvent entrer en conflit ; si tu penses qu'un des quatre points
   dessert le produit, écris-le.

Commence par le choix de catégorie et le tunnel de paiement — ce sont les deux qui changent
réellement le parcours. On validera avant d'aller vers la boutique.

## ▲▲▲ FIN DU PROMPT ▲▲▲

---

## Trois points à trancher avant l'implémentation

Ils ne bloquent pas le design, mais ils bloqueront le code.

### 1. La commission — le taux est ambigu

Vous avez dit : « une commission de 20 % pour les réservations de grandes sommes comme les
villas, puis une commission de 20 % pour les petites réservations ». **Deux fois le même
taux** — vraisemblablement un lapsus, puisque la phrase oppose deux cas.

Il me faut le barème réel avant de coder l'encaissement : taux unique de 20 % pour tout, ou
deux taux distincts avec un seuil ? Et la commission est-elle **prélevée sur ce que paie le
client** (le propriétaire touche 80 %) ou **ajoutée par-dessus** (le client paie 120 %) ? Les
deux se défendent, mais ils n'affichent pas le même prix sur la carte de villa.

### 2. Les textes juridiques redeviennent faux

Les documents que votre juriste vient de rendre disent, noir sur blanc : *« La plateforme
n'encaissant aucun paiement à ce jour, les remboursements éventuels relèvent d'un accord
direct entre le client et le propriétaire »*, et l'article 5 des CGU affirme la même chose.

Dès que PayDunya encaisse, ces clauses sont fausses — et une clause fausse sur les
remboursements est exactement ce qu'un agrégateur de paiement examine à l'ouverture d'un
compte marchand. **Il faut une seconde passe juridique** couvrant l'encaissement, la
commission, le reversement au propriétaire, et pour la boutique : la vente à distance, le
droit de rétractation et la livraison — dont rien n'est couvert aujourd'hui.

À lancer maintenant, en parallèle du design : c'est le délai le plus long.

### 3. « Studio meublé » n'existe pas dans le modèle de données

L'énumération actuelle est figée à `villa_entiere`, `appartement`, `chambre`, `piscine`. La
recherche par catégorie suppose une liste extensible — donc une table de catégories, une
migration, et la reprise des annonces existantes. C'est un chantier de fond, à faire avant
que la nouvelle recherche puisse exister.
