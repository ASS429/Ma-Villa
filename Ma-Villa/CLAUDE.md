# Ma Villa — application web

> Point d'entrée pour Claude Code sur le dossier `Ma-Villa/`.
> Le contexte produit complet est dans `../docs/` et `../Ma_Villa_Document_Reference_v2.docx`.

---

## Le produit

**Ma Villa** est une marketplace de location de villas et logements de vacances au Sénégal
(Saly, Mbour, Dakar), en préparation de lancement commercial.

Le modèle métier est la chose à comprendre avant de toucher au code :

```
Villa  →  Logements  →  Formules tarifaires
          (unités réservables      (journée / demi-journée / nuitée / pass
           indépendamment)          × avec ou sans clim
                                    × avec ou sans buffet)
```

Types de logement : `villa_entiere`, `appartement`, `chambre`, **`piscine`** (on peut
réserver la piscine seule à la journée — cas d'usage réel pour les fêtes de famille).

**C'est l'avantage concurrentiel sur Airbnb, qui ne sait pas représenter ça.** Toute
évolution d'interface doit garder ce modèle lisible.

Trois rôles : `client`, `proprietaire`, `admin`. Chaque villa passe par une validation
admin (`en_attente` → `validee` / `rejetee`) avant d'être publique.

---

## Stack

| | |
|---|---|
| React 19 + TypeScript 6 | Le compilateur React est installé mais **non branché** dans `vite.config.ts` |
| Vite 8 | `npm run dev` · `npm run build` · `npm run preview` |
| **Tailwind CSS v4** | ⚠️ Pas de `tailwind.config.js`. Toute la config passe par `@theme` dans `src/index.css` |
| React Router 7 | Routes publiques en direct, `/dashboard` et `/admin` en `lazy()` |
| axios | Instance unique dans `src/services/api.ts`, jeton Bearer depuis `localStorage` |
| lucide-react | Icônes |

API Laravel dans `../backend/`. `VITE_API_URL` pointe vers `.../api`.

---

## Conventions

- **Écrire en français** : interface, libellés, commentaires, messages d'erreur.
- **FCFA sans décimales**, via `fcfa()` de `src/lib/format.ts`. Jamais de `toLocaleString` en direct.
- **Passer par les tokens CSS** (`var(--accent)`, `var(--text-1)`…), pas de couleur en dur.
- **Ne jamais avaler une erreur.** Utiliser `useRequete` ou `messageErreur` + un toast.
- **Mobile d'abord, réseau lent.** Data mobile payée au volume sur ce marché : pas d'asset
  décoratif lourd, images en `loading="lazy"`, cibles tactiles ≥ 44 px.

## Briques transverses à réutiliser

| Fichier | Rôle |
|---|---|
| `src/types.ts` | Toutes les formes de données de l'API + libellés métier |
| `src/lib/format.ts` | `fcfa`, `dateCourte`, `noteLisible`, `nuits`, `aujourdhui` |
| `src/lib/erreurs.ts` | `messageErreur(err)` — traduit une erreur axios en message français |
| `src/lib/useRequete.ts` | Chargement de données : état unique, annulation, `reessayer()` |
| `src/context/ToastContext.tsx` | `useToast().succes/erreur/info` |
| `src/components/Seo.tsx` | Métadonnées par route (titre, description, Open Graph, JSON-LD) |
| `src/components/BarreRecherche.tsx` | Destination + dates + voyageurs |
| `src/components/Footer.tsx` | Pied de page commun, avec les liens légaux |
| `src/components/CoquilleAuth.tsx` | Cadre des écrans d'authentification |

---

## Design

Le design system est en place : tokens dans `src/index.css`, primitifs
`Button` / `Champ` / `Badge` dans `src/components/ui/`. Il n'existe plus de relevé
séparé — les tokens font foi, et un document parallèle finissait par les contredire.

**Couche de profondeur** (`src/styles/profondeur.css`, 18 août 2026) : perspective
commune, `Inclinable` pour les cartes, élévations, entrée en scène, transition
d'écran. Trois règles à tenir :

1. **Aucun effet ne porte d'information** — retirer toutes les animations doit
   laisser un produit complet.
2. **Trois couches composées simultanées au maximum** par écran.
3. **Le tunnel de paiement reste nu** — chaque milliseconde entre un montant et sa
   validation est un abandon.

**Pas de WebGL.** Une scène 3D coûte 300 à 600 Ko avant la première image, sur un
marché où la data est payée au volume. Toute la 3D est du CSS composé (`transform`
et `opacity` seulement).

**Console** (`src/styles/console.css`) : châssis partagé par l'administration
**et** l'espace personnel — barre latérale, tiroir mobile, cartes de chiffres,
panneaux, tableaux, pagination. Les deux espaces avaient chacun leur copie du
même agencement, stylée en ligne.

- Graphiques : `src/components/console/Graphe.tsx`, **SVG dessiné à la main**.
  Pas de Chart.js (~70 Ko gzip pour trois courbes).
- Pagination : `src/components/console/Pagination.tsx`, sur la forme paginée de
  Laravel (`{ data, current_page, last_page, total }`).
- ⚠️ **Cormorant Garamond dessine des chiffres elzéviriens par défaut** : sans
  `font-variant-numeric: lining-nums`, « 17 » se lit « I7 » et « 10 » se lit
  « IO ». Obligatoire sur toute valeur chiffrée en fonte display.
- ⚠️ **`position` dans une feuille du projet doit aller en `@layer components`**,
  sinon elle écrase les utilitaires Tailwind (`.absolute` notamment).

**Aucune couleur Tailwind en dur** ne subsiste dans `src/pages` ni dans les
composants : tout passe par les tokens, et le thème sombre suit partout. Les
`style={{ }}` restants ne portent que de la mise en page (`flex`, `gap`,
`minWidth`) et référencent des variables — les ajouts doivent faire de même.

`Login` et `Register` passent désormais par `CoquilleAuth`.

---

## SEO — pré-rendu au build

`scripts/prerendu.mjs` s'exécute après `vite build` : une page HTML par route,
avec titre, description, Open Graph, canonique et JSON-LD. Six pages fixes et
une par villa publiée. Le plan de site et `robots.txt` sont générés là aussi —
ne pas les recréer dans `public/`.

⚠️ **Barre oblique finale obligatoire** sur les URL de fiche. Render applique
sa réécriture avant de résoudre l'index d'un dossier : `/villas/10` sert le
gabarit générique, `/villas/10/` sert la page pré-rendue. Liens de
l'application, canonique, `og:url` et plan de site emploient tous cette forme.

`VITE_SITE_URL` bascule tout le pré-rendu le jour du nom de domaine ; sans
elle, c'est l'URL Render. Détail et pièges dans `../docs/`.

## Avant de déclarer une tâche terminée

```bash
npx tsc -b          # doit passer
npx eslint src      # doit être à zéro — c'est l'état actuel, ne pas le dégrader
npm run build
cd ../backend && php artisan test    # 421 tests
```

---

## État et suite

`../docs/11-CE-QUI-RESTE.md` dit où en est le produit et ce qui reste.
`../docs/08-AUDIT-COMPLET-ET-REFONTE.md` garde la trace de l'audit du 18 août —
sécurité, accessibilité, PWA — utile comme historique, pas comme état courant.
`../docs/05-INFRASTRUCTURE.md` liste ce qui tourne et les variables qui le règlent.

**Fait :** paiement Wave / Orange Money (encaissement réel validé) · PWA
installable avec notifications poussées · 30 vulnérabilités Composer corrigées.

**En production depuis le 19 août 2026**, front et API sur le même commit :
faille de tarif colmatée, 30 CVE Composer corrigées, PWA installable,
notifications poussées actives (clés VAPID posées et **signature vérifiée**),
console refondue et paginée, journal d'audit, limitation de débit.

Deux sondes dans la console, à utiliser **depuis l'interface** — une adresse
d'API ouverte dans un onglet répond toujours 401, le jeton vivant dans
`localStorage` : `/admin/paiement` (PayDunya) et `/admin/notifications` (VAPID).

**Reste bloquant pour le lancement :**

1. **Textes juridiques — rédaction en cours chez le juriste.** Les quatre pages
   portaient des affirmations devenues fausses le 18 août (« la plateforme
   n'encaisse aucun paiement »), présentées comme définitives.

   **Corrigé le 20 août** : `src/pages/legal/contenu.ts` ne contient plus de
   clauses mais une note d'attente — une description factuelle de ce que le
   logiciel fait, vérifiable dans le code, et l'annonce que la rédaction est
   confiée à un juriste. `TEXTES_PROVISOIRES` est repassé à `true`.

   ⚠️ **Ne pas le remettre à `false` avant d'avoir intégré les textes
   *validés*.** Le projet de CGU v2 dans `docs/juridique/v2-encaissement/` est
   une proposition **soumise** au juriste, pas un texte validé par lui : le
   publier serait refaire la même erreur. Les descriptions du pré-rendu vivent
   dans `scripts/prerendu.mjs`, pas dans le module — les tenir à jour aussi.

**Chantiers restants, par valeur :**

2. **Faire ouvrir l'option PER chez PayDunya** (demande envoyée le 20 août
   2026). Tout le code du déboursement est écrit et testé ; il ne manque que
   l'autorisation du prestataire, et `REVERSEMENT_AUTOMATIQUE=true`.
3. **Ouvrir la boutique** — elle est construite et déployée, mais invisible
   tant que `BOUTIQUE_ACTIVE` n'est pas levée. Il faut d'abord y mettre des
   œuvres, depuis `/admin/oeuvres`.

**Fait le 19 août 2026 :** journal d'audit lisible (`/admin/journal`) ·
messagerie client ↔ propriétaire · coordonnées retirées des écrans publics ·
suivi des reversements.

---

## Coordonnées et messagerie

Le numéro du propriétaire **ne sort plus** avant qu'un séjour soit engagé.
Publié sur la fiche, il permettait de conclure hors plateforme : la commission
s'évaporait et le client perdait avis vérifié, preuve de paiement et recours.

Trois verrous, et il faut les trois :

| Où | Règle |
|---|---|
| `GET /villas` | `scopeWithoutTelephone()` — la colonne ne part pas |
| `GET /villas/{id}` | `makeHidden('telephone')` sauf propriétaire ou admin ; `proprietaire:id,name,avatar` seulement |
| `GET /reservations[/{id}]` | `revelerLesCoordonnees()` — numéro révélé si la réservation est **confirmée** ou payée |

⚠️ **Le troisième est le moins évident et le plus important.** Ouvrir une
demande de réservation ne coûte rien et ne se paie pas : sans lui, il suffisait
d'en créer une, de lire `logement.villa.telephone`, puis d'annuler. Verrouillé
par `tests/Feature/CoordonneesTest.php` (11 tests).

La messagerie prend le relais : **la réservation est la conversation** — pas de
table de fil séparée, l'autorisation réutilise `ReservationPolicy::view`.
Écran `pages/dashboard/Conversation.tsx`, compteur de non-lus partagé par
`context/MessagesContext.tsx` (une requête pour la navigation *et* les cartes).
Notification poussée à chaque message, groupée par fil ; **pas d'email** — un
message est un échange, pas un jalon.

---

## Reversements

La plateforme encaisse **tout** sur son compte PayDunya, puis reverse. La part
du propriétaire était calculée et enregistrée depuis le premier encaissement
(`Commission::pour()` → `paiements.montant_proprietaire`) mais n'apparaissait
sur aucun écran : ni lui ni l'administrateur ne pouvaient dire ce qui restait
à verser.

`reversements` **enregistre** un versement, elle ne le déclenche pas. Un
paiement porte `reversement_id` : nul tant que la part n'est pas versée — c'est
ce seul champ qui distingue « dû » de « réglé », sans table de liaison.

Trois états, et le deuxième est celui à ne pas perdre :

| État | Règle | Portée |
|---|---|---|
| **À venir** | encaissé, séjour pas terminé | `Paiement::aVenir()` |
| **Dû** | encaissé, séjour **terminé**, non reversé | `Paiement::exigible()` |
| **Versé** | rattaché à un reversement | `reversement_id` non nul |

⚠️ **On ne verse pas avant la fin du séjour.** Verser d'avance, c'est devoir
réclamer un remboursement à un propriétaire qui a déjà dépensé l'argent. C'est
aussi la lecture retenue par les textes juridiques.

Deux autres règles tenues par les tests (`tests/Feature/ReversementTest.php`,
19 tests) :

- **Le montant n'est jamais lu dans la requête.** Il est sommé côté serveur à
  partir de ce qui est exigible. Un champ de somme envoyé par le navigateur,
  c'est une écriture comptable dictée par le navigateur. `reversement_id` est
  volontairement hors de `$fillable`.
- **Les paiements sont verrouillés (`lockForUpdate`) avant d'être sommés** :
  deux administrateurs qui enregistrent en même temps solderaient sinon les
  mêmes paiements, et la plateforme paierait deux fois.

Écrans : `pages/dashboard/Revenus.tsx` (propriétaire) et
`pages/admin/AdminReversements.tsx` (file d'attente + enregistrement).
Chaque versement part au journal d'audit et déclenche une notification poussée.

### Déboursement automatique (PayDunya PER)

Deux façons de verser coexistent, et c'est volontaire :

- **manuel** — un virement fait hors de l'application, simplement constaté.
  Réussi par construction ;
- **automatique** — `App\Services\Deboursement` envoie l'argent sur le Wave ou
  l'Orange Money du propriétaire.

⚠️ **L'option « Paiement Et Redistribution » (PER) est désactivée sur le compte
marchand au 20 août 2026.** Le code est complet et testé ; `REVERSEMENT_AUTOMATIQUE`
reste donc à `false`. Le jour de l'activation, la variable suffit — rien à
redéployer. La sonde `/admin/deboursement` dit ce que PayDunya répond
réellement : un code `401` signifie que l'option n'est toujours pas ouverte.

L'API vit en **v2** (`/api/v2/disburse/…`) quand l'encaissement est en v1, et se
déroule en trois temps :

| Appel | Effet |
|---|---|
| `get-invoice` | réserve un jeton. Statut « created » — **rien ne bouge** |
| `submit-invoice` | exécute. **L'argent part ici** |
| `check-status` | l'état réel, à toute heure |

C'est parce que `get-invoice` est inoffensif que la sonde peut exister sans
risque : elle initie et s'arrête là.

Les règles qui coûtent de l'argent si on les enfreint :

1. **La réponse de `submit-invoice` n'est pas une preuve.** Hors code `00`,
   PayDunya demande de relire `check-status` avec le même jeton. Un « échec »
   supposé sur un virement réellement parti se solderait par un second virement.
   Même principe que l'IPN d'encaissement, qui n'a jamais fait foi.
2. **Un échec rend les paiements à la file** (`reversement_id` → `null`), sinon
   le propriétaire attend un argent que plus rien ne réclame.
3. **Un doute ne rend rien.** `created` et `inconnu` restent « en cours » : les
   libérer autoriserait un second envoi. C'est le suivi qui tranche.
4. **`disburse_id` est notre garde-fou** (`MV-REV-{id}`) : PayDunya refuse de le
   rejouer, ce qui interdit le doublon.
5. **Aucune reprise automatique sur les appels HTTP.** Rejouer une requête qui
   envoie de l'argent est précisément ce qu'il ne faut pas faire.
6. Le numéro part **sans indicatif ni espaces** (`771234567`), le montant en
   **entier** — une décimale fait refuser la requête.

Le rappel `POST /api/reversements/rappel` est public (PayDunya refuse
l'initiation si l'URL ne répond pas), signé par le SHA-512 de la clé maîtresse,
et son corps n'est jamais cru : le statut est relu chez PayDunya.

`mavilla:suivre-reversements` tranche les versements restés en cours, toutes les
cinq minutes via `schedule:work` lancé par `start.sh`. Sans lui, un rappel perdu
laisserait un montant invisible des deux consoles à la fois.

Verrouillé par `tests/Feature/DeboursementTest.php` (18 tests, réponses
PayDunya simulées).

---

## Boutique d'œuvres d'art

Second métier, décidé le 12 août 2026 et construit le 20. Trois arbitrages de
l'utilisateur décident de toute l'architecture :

| Décision | Conséquence |
|---|---|
| **Ma Villa est le seul vendeur** | pas de rôle « artiste », pas de modération, pas de commission ni de reversement. L'artiste est une **colonne de l'œuvre**, pas un compte |
| **Une œuvre par commande** | pas de panier : on commande un article à la fois |
| **Frais de livraison par zone** | le client connaît son total **avant** de payer |

⚠️ **`BOUTIQUE_ACTIVE` est à `false`.** Les routes publiques répondent **404**,
pas 503 : un 503 dirait « ça existe, revenez plus tard » et inviterait les
moteurs à garder l'adresse. Les écrans redirigent vers l'accueil.

### La commande porte son propre paiement

Elle ne réutilise **pas** la table `paiements`, qui charrie `commission`,
`montant_proprietaire` et `reversement_id` — sans objet quand la plateforme est
le vendeur. Les y greffer aurait rendu nullable ce qui doit rester obligatoire
pour une réservation. Le client `PayDunya` est en revanche réutilisé tel quel :
il est générique.

### Les deux règles qui coûtent de l'argent

1. **Aucun montant ne vient de la requête.** Le prix est lu sur l'œuvre, les
   frais dans `config/boutique.php`, et les deux sont **figés à la commande** —
   relever un prix ne réécrit pas une vente passée. Même leçon que la faille du
   tarif. Vérifié en conditions réelles : une requête portant `montant_total: 1`
   produit bien une commande à 155 000.
2. **Une œuvre ne se vend qu'une fois.** `lockForUpdate` avant de vendre, et
   l'œuvre quitte la vitrine **dès la commande**, sans attendre le règlement —
   attendre laisserait une fenêtre pour un second acheteur. Une annulation la
   remet en vente, sinon une commande abandonnée l'immobiliserait pour toujours.

Une œuvre **vendue reste visible**, en fin de liste et en retrait : une galerie
qui efface ce qu'elle a vendu perd la preuve qu'elle vend.

### Catégories et stock

Le catalogue réel a corrigé une hypothèse du premier jet : ce ne sont pas des
toiles uniques mais surtout des bracelets, sandales, chemises — **reproductibles**.

- **`stock`**, par défaut à 1. Commander décrémente ; à zéro l'article passe
  « vendu », reste visible, ne s'achète plus. Annuler rend l'exemplaire ;
  réapprovisionner remet en vente **sans second geste**. Une pièce unique
  (stock 1) garde exactement le comportement d'origine.
- **Sept catégories**, dans `config/boutique.php` et **non en base** — à la
  différence des catégories de logement, qui portent unité de prix, formules et
  filtres. Celle-ci ne sert qu'à ranger : une table serait une jointure pour un
  libellé. `GET /oeuvres/categories` ne rend que les catégories **non vides** —
  un filtre qui ne rend rien use la confiance.

### Catalogue de démonstration

`php artisan db:seed --class=BoutiqueSeeder` — dix-neuf articles, idempotent
(le titre sert de clé). **Prix et artisans fictifs**, à remplacer avant
l'ouverture.

Les photographies vivent dans `Ma-Villa/public/oeuvres/` et sont référencées en
**chemin relatif** (`/oeuvres/x.jpg`) : une URL absolue serait à réécrire le jour
du nom de domaine. Les originaux étaient des `.jfif` — des JPEG, mais le
téléverseur valide sur l'extension et les refusait.

`tests/Feature/BoutiqueTest.php` — 36 tests.

### Ce que la vérification au navigateur a trouvé

Deux défauts que ni `tsc` ni les tests ne pouvaient voir, et qui auraient rendu
la boutique inaccessible :

- **Les écrans redirigeaient vers l'accueil au premier rendu**, lisant
  « fermée » alors que la configuration n'était pas encore arrivée. D'où le
  drapeau `chargee` dans `ConfigContext` : *ne pas encore savoir* n'est pas
  *fermé*. Il passe à vrai même quand toutes les reprises échouent — un
  chargement infini est pire qu'un repli.
- **Les boutons pointaient vers `/connexion`**, qui n'existe pas : la route est
  `/login`, et elle gère déjà `?retour=`.

**Leçon à retenir : pour tout écran gardé par une configuration distante,
vérifier au navigateur.** Le typage ne voit pas un garde qui se déclenche une
milliseconde trop tôt.
