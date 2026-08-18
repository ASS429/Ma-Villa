# Ma Villa — audit complet, corrections et refonte

**Date :** 18 août 2026
**Périmètre :** sécurité, fonctionnel, accessibilité, performance, design, PWA
**Branche :** `design-etape-3`

---

## Résumé en une page

La plateforme est en bien meilleur état que ne le laisse penser la liste
ci-dessous : l'architecture est saine, le code est commenté avec soin, et la
couverture de tests était déjà sérieuse. Les défauts trouvés sont ceux qu'on ne
voit pas en relisant — il fallait les provoquer.

**Une faille grave a été trouvée et corrigée : le client choisissait son prix.**
Voir §1.1. Elle était exploitable en production, sans compte particulier, et
aboutissait à des réservations confirmées et payées au centième du tarif.

| | Avant | Après |
|---|---|---|
| Tests backend | 176 | **208** (+32) |
| Vulnérabilités Composer | **30** (2 hautes) | **0** |
| Vulnérabilités npm | 0 | 0 |
| Laravel | 13.5.0 | 13.26.0 |
| Contrôles sans nom accessible | 4 écrans concernés | **0** |
| Point de repère `<main>` | absent partout | présent |
| PWA installable | non | **oui** (manifeste, service worker, hors ligne) |
| Listes d'administration | table entière chargée | **paginées + recherche** |
| Console (admin + espace perso) | styles en ligne, deux copies | **châssis partagé, tokens** |
| Notifications poussées | inexistantes | **implémentées** (VAPID, 11 tests) |

Tout ce qui est marqué « corrigé » a été vérifié : test qui échoue d'abord,
puis passe ; ou mesure au navigateur avant/après. Rien n'est déclaré sur la foi
d'une relecture.

---

## 1. Sécurité

### 1.1 🔴 CRITIQUE — Le client choisissait le prix de sa réservation *(corrigé)*

**Ce qui se passait.** `ReservationRequest` validait `tarif_id` par
`exists:tarifs,id` : *n'importe quel* identifiant de tarif de la base était
accepté, sans vérifier qu'il appartenait au logement réservé.

`ReservationController::store` calculait ensuite
`montant = tarif->prix × nombre de jours`.

**L'exploitation.** Un client repère le tarif le moins cher de la plateforme
(une chambre à 1 000 F la nuit), puis réserve la villa la plus chère en
envoyant cet identifiant-là :

```json
POST /api/reservations
{ "logement_id": <la villa à 100 000 F>, "tarif_id": <la chambre à 1 000 F>, … }
```

La réservation était créée en `201` à **1 000 F la nuit au lieu de 100 000 F**.
Le tunnel de paiement portait sur ce montant, PayDunya l'encaissait, l'IPN le
confirmait — et la réservation passait en `confirmee`. Le propriétaire
découvrait le prix réel à l'arrivée du client.

Aucun compte particulier n'était nécessaire, aucune manipulation de session :
un seul champ modifié dans la requête.

**Le correctif.** Le tarif est désormais contraint au logement :

```php
'tarif_id' => [
    'required',
    Rule::exists('tarifs', 'id')->where('logement_id', $this->input('logement_id')),
],
```

**Vérification.** Test `test_reservation_rejects_a_tarif_from_another_logement` —
il renvoyait `201` avant, il exige `422` et zéro réservation créée après.

> **À faire de votre côté :** vérifier en base de production s'il existe des
> réservations dont le `tarif_id` ne correspond pas au `logement_id`. Requête
> fournie en §8.

---

### 1.2 🟠 Changer d'adresse email conservait la vérification *(corrigé)*

`updateProfile` écrivait la nouvelle adresse sans toucher à
`email_verified_at`. Un compte vérifié le restait sur une adresse que personne
n'avait jamais confirmée — **y compris celle de quelqu'un d'autre**. Toute la
garantie apportée par la vérification d'adresse tombait.

Désormais : changer d'adresse remet `email_verified_at` à `null` et envoie un
nouveau lien. Garder la même adresse ne touche à rien (deux tests distincts).

### 1.3 🟠 Changer son mot de passe ne fermait pas les autres sessions *(corrigé)*

`resetPassword` (mot de passe oublié) révoquait bien tous les jetons.
`updateProfile` — le changement depuis son profil — n'en révoquait aucun.

C'est le geste de quelqu'un qui pense son compte compromis. Le laisser sans
effet sur les sessions ouvertes le rend inutile : celui qui est entré y reste.

Désormais tous les jetons sont supprimés **sauf celui de la session courante**,
sans quoi l'utilisateur se déconnecterait lui-même.

### 1.4 🟠 Un administrateur pouvait supprimer le dernier administrateur *(corrigé)*

`AdminController::supprimerUtilisateur` ne protégeait rien. Le bouton est à un
pixel de celui des clients dans la liste, et une plateforme sans administrateur
ne se répare plus par l'interface : validation des villas, modération des avis,
sonde de paiement deviennent inatteignables.

Désormais : ni son propre compte, ni un autre compte admin (`422` explicite).
Retirer un administrateur reste possible en base, délibérément.

### 1.5 🟠 Double réservation sur les mêmes dates *(corrigé)*

La vérification de chevauchement et la création se faisaient sans transaction
ni verrou. Deux demandes simultanées sur le même logement constataient toutes
deux un créneau libre avant que l'autre n'ait écrit : **la même nuit était
vendue deux fois**, et c'est le propriétaire qui l'apprenait à l'arrivée des
clients.

Désormais la vérification et la création sont dans une transaction, précédées
d'un `lockForUpdate` sur la ligne du logement. Deux demandes concurrentes sur le
même logement s'exécutent l'une après l'autre ; celles qui visent d'autres
logements ne s'attendent pas.

> ⚠️ **Non reproduit par un test.** Une course exige deux connexions
> simultanées, ce que SQLite en mémoire ne permet pas. Le correctif est
> structurel et les 208 tests existants passent, mais la garantie sous charge
> réelle demanderait un test d'intégration sur PostgreSQL. Voir §7.

### 1.6 🟠 Trente vulnérabilités dans les dépendances PHP *(corrigé)*

`composer audit` remontait **30 avis sur 10 paquets**, dont deux de gravité
haute :

| Paquet | Avis | Le plus grave |
|---|---|---|
| guzzlehttp/guzzle | 9 | contournement de contrôle d'hôte (haute) |
| league/commonmark | 6 | 4 avis hauts |
| guzzlehttp/psr7 | 4 | injection CRLF, confusion d'hôte |
| laravel/framework | 3 | injection CRLF dans la règle email (haute) |
| symfony/* | 7 | http-kernel (haute), routing, mime, mailer |
| symfony/polyfill-intl-idn | 1 | faible |

Laravel est passé de **13.5.0 à 13.26.0**. `composer audit` renvoie désormais
« No security vulnerability advisories found ». Les 208 tests passent après la
mise à jour.

### 1.7 🟡 Ce qui reste à traiter

| # | Sujet | Détail |
|---|---|---|
| a | **URL de photo non validée** | `PhotoController::storeForVilla` accepte `photos.*.url` en `string` sans contrôle de schéma. Un propriétaire peut enregistrer une URL arbitraire (suivi par pixel, contenu tiers). À restreindre à `https://` et, idéalement, au domaine de stockage. |
| b | ~~**Listes d'administration sans pagination**~~ | ✅ **Corrigé** — voir §5 bis. Les trois listes sont paginées, plafonnées à 100 par page, avec recherche. |
| c | **Aucune limite de débit sur les écritures** | Seules les routes d'authentification sont limitées. `POST /reservations`, `POST /avis`, `POST /upload` ne le sont pas : un compte peut créer des milliers de réservations ou saturer le stockage. |
| d | **Pas de journal d'audit** | Aucune trace de qui a validé une villa, supprimé un avis ou un compte. En cas de litige, rien à produire. |

---

## 2. Bugs fonctionnels

### 2.1 🔴 La page de résultats s'affichait vide *(corrigé)*

**Le symptôme le plus visible du produit, et personne ne l'avait vu** — parce
qu'il disparaît dès qu'on fait défiler.

`ScrollReveal` révélait son contenu via un `IntersectionObserver` de seuil
`0.08`. Ce seuil porte sur **la hauteur de l'élément observé**, pas sur la
portion visible de l'écran. Sur `/villas`, la grille des villas mesure près de
**5 000 px** : les ~300 px visibles sous l'en-tête n'en représentent que **6 %**.
Le seuil de 8 % n'était donc jamais atteint au chargement.

Résultat mesuré au navigateur : **12 cartes présentes dans le DOM, toutes à
`opacity: 0`**, sous le texte « 20 villas trouvées · page 1/2 ». Il fallait
défiler pour faire apparaître ce qu'on était venu voir.

**Corrigé** par `threshold: 0` — qui déclenche au premier pixel et ne dépend
donc pas de la taille du contenu — **et** par un filet de sécurité qui révèle au
bout d'1,5 s quoi qu'il arrive. Le contenu ne doit jamais rester invisible parce
qu'un observateur n'a pas répondu : une animation ratée est un détail, un
catalogue invisible est une panne.

Vérifié avant/après au navigateur : `opacity` passée de `0` à `1`, classe
`sr-visible` posée.

### 2.2 🟠 `Login` et `Register` dupliquent `CoquilleAuth` *(partiellement corrigé)*

`CoquilleAuth` existe et sert `EmailVerifie`, `MotDePasseOublie` et
`ReinitialiserMotDePasse`. Mais **les deux écrans les plus utilisés — connexion
et inscription — en recopient le balisage en ligne**.

Conséquence concrète, mesurée : la bascule de thème et le lien du logo y étaient
dépourvus de nom accessible, alors que la version partagée en avait un. Corriger
`CoquilleAuth` ne les atteignait pas.

Les noms manquants ont été ajoutés aux deux copies. **La duplication elle-même
reste à supprimer** : tant qu'elle existe, toute correction dans la coquille
partagée manquera silencieusement ces deux écrans.

### 2.3 🟡 Le développement local ne démarre pas seul

`backend/.env` pointe vers `DB_HOST=db` (le MySQL de `docker-compose`). Sans
Docker lancé, toute l'API répond `500`. Un `database/database.sqlite` existe
pourtant et fonctionne.

À documenter dans le README, ou à basculer par défaut sur SQLite en local.

---

## 3. Accessibilité

Audit automatisé sur 6 écrans (accueil, recherche, connexion, inscription, CGU,
404).

**Déjà bon avant l'audit :** un seul `<h1>` par page, aucune image sans `alt`,
aucun champ sans étiquette, `lang="fr"`.

### Corrigé

| Défaut | Portée | Correctif |
|---|---|---|
| **Aucun point de repère `<main>`** | les 6 écrans | `<main id="contenu">` autour des routes |
| **Aucun lien d'évitement** | les 6 écrans | « Aller au contenu », visible au focus seulement |
| **Contrôles sans nom accessible** | connexion, inscription | bascule de thème, lien du logo, bascules d'affichage du mot de passe |
| **Bascule du mot de passe hors tabulation** | connexion, inscription | `tabIndex={-1}` retiré, `aria-pressed` ajouté |
| **Cibles tactiles < 44 px** | boutons à icône | zone portée à 44 px par pseudo-élément, sans déplacer la mise en page |

Après correction : **0 contrôle sans nom, `<main>` et lien d'évitement présents
sur les 6 écrans.**

### Reste

Les **liens de texte** (pied de page, « Mot de passe oublié ? », « S'inscrire »)
mesurent 18 à 32 px de haut. La règle d'agrandissement est écrite mais
conditionnée à `@media (pointer: coarse)` : elle ne s'applique donc qu'au doigt,
et **n'a pas pu être mesurée en navigateur sans écran tactile**. Elle est correcte
par construction, pas par mesure — à vérifier sur un téléphone réel.

Ce choix est délibéré : élargir à 44 px un lien posé au milieu d'une phrase
déborderait sur les lignes voisines et capterait des clics destinés à autre chose.

---

## 4. Progressive Web App — implémentée

L'application est désormais **installable sur mobile et sur ordinateur**, et
fonctionne hors ligne.

### Ce qui a été livré

| Élément | Fichier | Rôle |
|---|---|---|
| Manifeste | `public/manifest.webmanifest` | nom, thème, `display: standalone`, 3 raccourcis |
| Icônes | `public/icon-{192,512}.png` + variantes `maskable` | générées depuis la source 1254 px, quantifiées (−60 % de poids) |
| Service worker | `public/sw.js` | cache, hors ligne, notifications |
| Page hors ligne | `public/hors-ligne.html` | autonome : aucune police ni image distante |
| Module client | `src/lib/pwa.ts` | installation, abonnement, désabonnement |
| Invitation | `src/components/app/InvitationInstallation.tsx` | proposée après 3 écrans, refus mémorisé 2 mois |
| Réglage | `src/components/app/ReglageNotifications.tsx` | dans le profil, par appareil |

### Vérifié au navigateur, pas supposé

```
manifest          200, standalone, 4 icônes (toutes 200), 3 raccourcis
service worker    enregistré, état « activated », scope /
PushManager       disponible
caches créés      coquille, assets, images, api
page hors ligne   200
theme-color       clair + sombre
viewport          viewport-fit=cover
```

**Test hors ligne réel** (réseau coupé par le pilote) : l'application rend
intégralement, titre et contenu compris, sur une route jamais visitée.

### Deux règles tenues dans le service worker

1. **Aucune réponse authentifiée n'entre en cache.** Un cache est partagé par
   tous les profils du navigateur et survit à la déconnexion : y écrire une
   réservation ou un profil laisserait des données personnelles sur l'appareil.
   Toute requête portant un en-tête `Authorization` est laissée au réseau.

   *Vérifié* : après connexion et appels à `/auth/me`, `/reservations` et
   `/favoris` (tous `200`), **aucune route privée n'apparaît dans aucun cache**.

2. **Rien du tunnel de paiement n'est servi depuis le cache.** Un statut périmé
   ferait croire à un encaissement qui n'a pas eu lieu.

### Un défaut trouvé par le test hors ligne

Le logo était préchargé dans le cache « coquille », mais le gestionnaire
d'images ne consultait que son propre cache : il échouait quand même hors ligne.
Corrigé par un repli sur `caches.match()`, qui cherche dans tous les caches.
L'image d'en-tête a été ajoutée à la coquille dans la foulée.

### Notifications poussées

- **Backend** : table `abonnements_push`, modèle, contrôleur, service d'envoi
  (`minishlink/web-push` v10), commande `php artisan push:cles`.
- **Branchées** sur les trois moments qui comptent : demande de réservation
  reçue (propriétaire), réservation confirmée ou annulée (client), paiement
  encaissé (propriétaire).
- **11 tests**, dont : un endpoint non-URL est refusé ; réabonner le même
  appareil remplace au lieu de doubler ; on ne peut pas désabonner l'appareil
  d'autrui ; les clés de chiffrement ne sortent jamais de l'API ; supprimer un
  compte emporte ses abonnements.

**Principe tenu :** une notification poussée est un *rappel*, jamais un canal de
vérité. Elle double l'email, elle ne le remplace pas — un utilisateur qui n'a
rien autorisé doit tout apprendre malgré tout. Un échec d'envoi n'interrompt
jamais l'action métier.

> **⚠️ Trois choses à faire avant que les notifications ne fonctionnent en
> production**, détaillées en §8 : générer les clés VAPID, les poser sur
> Railway, et **redéployer l'image Docker** — l'extension PHP `gmp` vient d'être
> ajoutée au `Dockerfile` et la crypto VAPID ne fonctionne pas sans elle.

---

## 5. Design — ce qui a été fait, ce qui reste

### Le point de départ

Contrairement à ce que laissait supposer la demande, **le design n'était pas à
refaire depuis zéro**. Le système en place est sérieux : 2 000 lignes de tokens,
primitifs `Button` / `Champ` / `Badge`, feuilles modales, navigation basse,
cibles tactiles, `prefers-reduced-motion` traité partout. Sur mobile, l'accueil
ressemble déjà à une application : barre flottante en verre, en-tête pleine
largeur, barre d'onglets basse à quatre entrées.

Repartir de zéro aurait détruit des arbitrages déjà pris et documentés (le
bronze olive pour l'AA, la carte en 4/3, l'accent réservé à la conversion en
cours). **J'ai donc ajouté une couche, pas remplacé le socle.**

### La couche de profondeur — `src/styles/profondeur.css`

| Bloc | Effet |
|---|---|
| Scène et perspective | espace 3D commun à 1200 px — une seule valeur, sinon l'effet fait « bricolage » |
| `Inclinable` | la carte s'incline vers le curseur, le contenu décollé de 28 px, reflet qui suit la lumière |
| Élévations | 4 niveaux, ombre + halo ; en thème sombre, c'est le liseré clair qui porte le relief |
| Entrée en scène | les éléments arrivent **du fond**, pas en glissant — c'est ce qui distingue une application d'un site qui déroule |
| Cascade | 45 ms entre enfants, plafonnée au 9e |
| Transition d'écran | API View Transitions native |
| Surfaces en verre | avec repli complet si le floutage n'est pas géré |
| Réponse au doigt | 100 ms linéaire — le seuil sous lequel geste et effet sont perçus comme un seul événement |

### Pourquoi pas de WebGL / Three.js

Une scène 3D coûte **300 à 600 Ko de moteur avant la première image**, tient le
processeur graphique éveillé et vide la batterie. Sur ce marché, la data est
payée au volume et les appareils sont souvent d'entrée de gamme : ce serait une
dégradation vendue comme une modernisation.

Toute la 3D livrée est du CSS composé — `transform` et `opacity` uniquement, les
deux seules propriétés que le navigateur anime sans repasser par la mise en
page. **Coût réseau : zéro octet de script.** Le paquet n'a grossi que de
**1,7 Ko gzip**, PWA comprise.

Si vous voulez malgré tout une vraie scène 3D (visite immersive d'une villa, par
exemple), c'est une décision à prendre écran par écran, avec un budget assumé —
pas une couche globale.

### Trois règles tenues

1. **Aucun effet ne porte d'information.** Retirer toutes les animations doit
   laisser un produit complet. C'est le test d'entrée de chaque effet.
2. **Trois couches composées simultanées au maximum** par écran.
3. **Le tunnel de paiement reste nu.** Chaque milliseconde ajoutée entre un
   montant et sa validation est un abandon.

### Reste à faire

- **Le tableau de bord et l'administration utilisent encore des styles en
  ligne** pour leurs surfaces. Seuls les boutons ont été alignés sur les tokens.
  C'est le plus gros chantier de design restant — une vingtaine d'écrans.
- `Inclinable` n'est appliqué qu'à la carte de villa. Les cartes du tableau de
  bord, les modales et les blocs de statistiques peuvent en bénéficier.
- Le bouton flottant « Voir sur la carte » recouvre le titre de la première
  carte sur mobile.

---

## 5 bis. Console d'administration et espace personnel — refondus

Demandé après la première passe : *« refais le dashboard admin en t'inspirant
de Campus Crush »*. Trois idées reprises de cette console, le reste adapté à
Ma Villa.

### Ce qui a été repris de Campus Crush

| Idée | Pourquoi elle est bonne |
|---|---|
| **Compteur d'attente sur la navigation** | Dit ce qui réclame une action *avant* d'ouvrir l'écran. Sans lui, on ouvre « Villas » pour découvrir qu'il n'y a rien à faire — ou, plus coûteux, on ne l'ouvre pas alors que douze annonces attendent depuis trois jours. |
| **Tiroir plein écran au doigt** | Une console consultée depuis un téléphone doit se naviguer d'une main. |
| **Fil d'activité** | « Que s'est-il passé depuis hier ? » n'a pas de réponse dans une liste de totaux. |

### Ce qui a été fait différemment

- **Couleurs par les tokens, pas en dur.** Campus Crush écrit ses teintes dans
  le balisage (`#ff5e6c`, `bg-white/5`). Ici tout passe par les variables : la
  console suit le thème sombre sans une ligne de plus.
- **Graphiques sans bibliothèque.** Chart.js coûte environ **70 Ko gzip** pour
  trois courbes. Sur ce marché la data est payée au volume : les graphes sont
  dessinés à la main en SVG (`components/console/Graphe.tsx`), pour **zéro
  octet de script**. Même raisonnement que le refus du WebGL et que le code QR
  dessiné localement.
- **Barres horizontales plutôt qu'un camembert** pour la répartition par ville :
  on y compare des longueurs alignées sur une même base, là où un camembert
  demande de comparer des angles — ce que l'œil fait mal au-delà de quatre parts.
- **Un seul châssis pour les deux espaces.** L'administration et l'espace
  propriétaire/client avaient chacun leur copie du même agencement, stylée en
  ligne. Ils partagent désormais `styles/console.css` : corriger l'un corrige
  l'autre.

### API enrichie

`GET /admin/stats` ne renvoyait que cinq entiers. Elle renvoie maintenant des
chiffres qui répondent à une question qu'on se pose vraiment — « 412
utilisateurs » n'en est pas une, « 412 dont 38 ce mois-ci, en hausse de 12 % »
en est une :

- **utilisateurs** — total, nouveaux sur 30 j, variation, répartition par rôle ;
- **villas** — en attente, validées, rejetées, en vedette ;
- **réservations** — par statut, volume de la période, variation ;
- **finances** — volume réservé **et** encaissé, distinctement, plus la
  commission et les paiements bloqués ;
- **avis** — total et note moyenne.

> La variation vaut `null` quand la période précédente est vide, et non zéro :
> « +100 % » sur un premier inscrit serait un chiffre inventé.

Deux routes nouvelles : `GET /admin/statistiques` (séries de 30 jours, tous les
jours présents même à zéro — une série trouée se dessine comme une droite entre
deux points éloignés et invente une activité qui n'a pas eu lieu) et
`GET /admin/activite` (fil des douze derniers événements, trois flux mêlés).

L'agrégation par jour est portable SQLite ↔ PostgreSQL : `DATE(colonne)` n'existe
pas en Postgres, où il faut `colonne::date`. Deux bugs sont déjà passés à travers
cent tests pour cette raison.

### Pagination — le défaut §1.7 b, corrigé

Les trois listes chargeaient la table entière. Elles sont désormais paginées
(20 par page, plafond 100), avec **recherche** sur les villas (nom, ville) et
les comptes (nom, email), et filtre par rôle.

> ⚠️ **Changement de forme d'API** : ces trois routes renvoient maintenant
> `{ data, current_page, last_page, total }` au lieu d'un tableau nu. Six tests
> existants ont été mis à jour ; tout client tiers éventuel devrait l'être aussi.

### Deux défauts trouvés à l'écran, pas à la relecture

**Les chiffres étaient illisibles.** Cormorant Garamond dessine par défaut des
chiffres **elzéviriens**, dont le « 1 » est un bâton sans empattement. Sur le
tableau de bord, « 17 » se lisait « I7 » et « 10 » se lisait « IO ». Sur un
écran dont l'objet est de montrer des nombres, c'est disqualifiant. Corrigé par
`font-variant-numeric: lining-nums tabular-nums`, ici et sur `.stat-value`.

**Un `position` a cassé l'écran de connexion.** La règle d'agrandissement des
cibles tactiles posait `position: relative` hors de toute couche CSS ; elle
l'emportait donc sur les utilitaires Tailwind et écrasait le `absolute` de la
bascule de thème, qui quittait son coin et décalait toute la page. Corrigé en
passant la déclaration en `@layer components`. **Trouvé par capture d'écran —
ni TypeScript ni ESLint ne pouvaient le voir.**

### Espace personnel

Le tableau de bord propriétaire/client affichait quatre compteurs et avalait ses
erreurs (`.catch(() => {})`) : sur panne réseau, un espace vide se lisait comme
un compte sans aucune réservation. Il est passé à `useRequete`, et montre
désormais ce sur quoi on peut agir :

- **propriétaire** — bandeau « N demandes attendent votre réponse », villas
  publiées et en validation, volume confirmé, séjour en cours ;
- **client** — bandeau « N réservations à régler » (le paiement restait
  difficile à retrouver), prochain séjour, favoris.

Un séjour déjà commencé est libellé « Séjour en cours » et non « Prochain
séjour », et montre alors la date de **départ** : afficher une date passée sous
« prochain » se lit comme un bug d'affichage.

### Vérifié au navigateur

Connecté en administrateur, en propriétaire et en client, en 1280 px et 375 px,
thèmes clair et sombre :

```
tableau de bord admin   8 cartes · 2 courbes · 12 lignes d'activité · compteur « 3 »
liste des comptes       10 lignes paginées, filtres, recherche
liste des villas        3 annonces en attente, actions Valider / Rejeter
espace propriétaire     bandeau « 5 demandes », séjour en cours
espace client           14 réservations, filtres, onglets défilants
tiroir mobile           role=dialog, aria-modal, voile, 6 liens
thème sombre            fond #0c0a08, cartes et courbes suivent les tokens
débordement horizontal  aucun, sur tous les écrans testés
erreurs console         0
```

---

## 6. Performance

| Mesure | Valeur |
|---|---|
| Paquet initial | 316 Ko brut / ~94 Ko gzip |
| CSS | 83 Ko brut |
| Jeu d'icônes PWA | 286 Ko (quantifié depuis 745 Ko) |
| Build | ~3 s |
| Routes privées | en `lazy()` |

**Piste principale** : le CSS a atteint 83 Ko et contient des blocs hérités
explicitement marqués « compatibilité pendant la migration » (`--border-2`,
`--accent-gold`, `--accent-warm`) ainsi qu'un mode vidéo (`html.video-mode`)
alors que la règle du projet est « une image en hero, jamais de vidéo ».
Un nettoyage est possible.

---

## 7. Ce qui n'a pas été fait, et pourquoi

Par honnêteté sur le périmètre :

| Non fait | Raison |
|---|---|
| **Refonte de tous les écrans un par un** | ~35 écrans. La couche de design les élève tous ; le parcours public, l'administration et l'espace personnel sont traités. **Restent en styles en ligne** : `GererVilla` (50 occurrences), `NouvelleVilla` (20), `MesVillas` (12), `Favoris` (9) — les écrans de création et de gestion d'annonce. |
| **Test de la course à la double réservation** | exige deux connexions concurrentes ; SQLite en mémoire ne le permet pas. Demande une CI sur PostgreSQL. |
| **Mesure des cibles tactiles en texte** | la règle est sous `@media (pointer: coarse)`, que Chromium headless ne déclenche pas. À vérifier sur téléphone. |
| **Envoi réel d'une notification poussée** | demande des clés VAPID de production et un abonnement d'appareil réel. La génération de clés a été vérifiée localement (avec `gmp` activé), l'API et les 11 tests couvrent le reste. |
| **Pré-rendu SEO des fiches villa** | chantier à part entière (SSR ou pré-rendu au build). Toujours ouvert depuis l'audit du 8 août. |
| **Application mobile native (`mobile/`)** | dossier Expo présent mais hors du périmètre demandé. Non touché, non testé. |

---

## 8. À faire de votre côté — par ordre d'urgence

### 🔴 Immédiat

1. **Vérifier l'exploitation passée de la faille de tarif** (§1.1). En base de
   production :

   ```sql
   SELECT r.id, r.montant_total, r.statut, r.created_at,
          l.villa_id, t.logement_id AS tarif_appartient_a
   FROM reservations r
   JOIN tarifs t    ON t.id = r.tarif_id
   JOIN logements l ON l.id = r.logement_id
   WHERE t.logement_id <> r.logement_id;
   ```

   Toute ligne renvoyée est une réservation au mauvais prix.

2. **Faire relire les textes juridiques.** Les CGU et la politique d'annulation
   affirment encore, en toutes lettres :

   > « aucun paiement n'est encaissé par la plateforme : le règlement s'effectue
   > directement entre le client et le propriétaire […] Ma Villa n'intervient ni
   > dans la transaction, ni dans sa sécurisation. »

   C'est **faux depuis l'encaissement réel du 18 août 2026**, et la commission
   de 10–20 % n'y figure nulle part. Quatre passages concernés dans
   `Ma-Villa/src/pages/legal/contenu.ts` (lignes 7, 90, 203, 231). Le drapeau
   `TEXTES_PROVISOIRES` est pourtant à `false` et aucune mention
   `[À COMPLÉTER]` ne subsiste : **les textes se présentent comme définitifs
   alors qu'ils décrivent une plateforme qui n'existe plus.**

3. **Redéployer Railway à la main.** Render se redéploie seul, Railway non — et
   `GET /api/configuration` renvoie `version` pour le vérifier sans deviner.

### 🟠 Avant d'activer les notifications

4. **Générer les clés VAPID**, une seule fois :

   ```bash
   php artisan push:cles
   ```

   Les régénérer plus tard invaliderait tous les abonnements en place, et
   chaque utilisateur devrait réautoriser à la main.

5. **Poser les trois variables sur Railway** : `VAPID_SUJET`,
   `VAPID_CLE_PUBLIQUE`, `VAPID_CLE_PRIVEE`. Tant qu'elles sont absentes, la
   fonction reste dormante et aucun bouton n'apparaît — rien ne casse.

6. **Redéployer l'image Docker.** L'extension PHP `gmp` a été ajoutée au
   `Dockerfile` : sans elle, `push:cles` et tout envoi échouent sur
   « Unable to create the key », sans que rien ne désigne l'extension manquante.

### 🟡 Ensuite

7. Limiter le débit des routes d'écriture (§1.7 c).
8. Valider le schéma des URL de photo (§1.7 a).
9. Supprimer la duplication `Login` / `Register` ↔ `CoquilleAuth` (§2.2).
10. Finir l'alignement sur les tokens : `GererVilla`, `NouvelleVilla`,
    `MesVillas`, `Favoris` (§5 bis).
11. Pré-rendu SEO des fiches villa.
12. Journal d'audit des actions d'administration (§1.7 d).

---

## 9. Méthode de vérification

Rien n'a été déclaré corrigé sans preuve. Pour chaque défaut : un test qui
échoue d'abord, ou une mesure au navigateur avant et après.

```bash
# Backend — 208 tests
cd backend && php artisan test
composer audit                      # doit rester à zéro

# Frontend
cd Ma-Villa
npx tsc -b                          # doit passer
npx eslint src                      # doit rester à zéro
npm run build
npm audit --omit=dev                # doit rester à zéro
```

**Vérification au navigateur** (headless, sur le build de production) :
manifeste et icônes, enregistrement du service worker, coupure réseau réelle,
absence de route privée en cache après connexion, mise en page à 375 px,
débordement horizontal, zone tapable effective, audit d'accessibilité sur
6 écrans.

Scripts de contrôle conservés dans le dossier de travail de la session
(`qa-pwa.mjs`, `qa-hors-ligne.mjs`, `qa-cache-auth.mjs`, `qa-mobile.mjs`,
`qa-a11y.mjs`) — à reprendre dans le dépôt s'ils doivent servir en continu.

---

## 10. Fichiers touchés

**Créés (14)**

```
Ma-Villa/public/manifest.webmanifest
Ma-Villa/public/sw.js
Ma-Villa/public/hors-ligne.html
Ma-Villa/public/icon-{192,512}.png
Ma-Villa/public/icon-maskable-{192,512}.png
Ma-Villa/src/lib/pwa.ts
Ma-Villa/src/styles/profondeur.css
Ma-Villa/src/components/ui/Inclinable.tsx
Ma-Villa/src/components/app/InvitationInstallation.tsx
Ma-Villa/src/components/app/ReglageNotifications.tsx
backend/app/Models/AbonnementPush.php
backend/app/Services/Push.php
backend/app/Http/Controllers/Api/NotificationPushController.php
backend/app/Console/Commands/GenererClesPush.php
backend/database/migrations/2026_08_18_000002_cree_la_table_des_abonnements_push.php
backend/config/push.php
backend/tests/Feature/DurcissementTest.php
backend/tests/Feature/NotificationPushTest.php
```

**Créés — console (2e passe)**

```
Ma-Villa/src/styles/console.css
Ma-Villa/src/components/console/Graphe.tsx
Ma-Villa/src/components/console/Pagination.tsx
backend/tests/Feature/AdminConsoleTest.php
```

**Refondus — console (2e passe)** : `AdminLayout`, `AdminDashboard`,
`AdminVillas`, `AdminUtilisateurs`, `AdminAvis`, `DashboardLayout`,
`Dashboard`, `Reservations` · côté serveur `AdminController` (réécrit),
`routes/api.php`, `AdminTest`.

**Modifiés (23, 1re passe)** — sécurité : `ReservationRequest`, `ReservationController`,
`AuthController`, `AdminController` · PWA : `index.html`, `main.tsx`, `App.tsx`,
`ConfigContext`, `ConfigurationController`, `PaiementController`, `routes/api.php`,
`Dockerfile` · design et accessibilité : `index.css`, `ScrollReveal`, `VillaCard`,
`CoquilleAuth`, `Login`, `Register`, `Profil` · dépendances : `composer.json`,
`composer.lock`.
