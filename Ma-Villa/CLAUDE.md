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
`Button` / `Champ` / `Badge` dans `src/components/ui/`. Relevé de l'existant dans
`../docs/02-DESIGN-SYSTEM-EXTRAIT.md`.

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
cd ../backend && php artisan test    # 229 tests
```

---

## État et suite

`../docs/08-AUDIT-COMPLET-ET-REFONTE.md` est l'état de référence (18 août 2026) :
audit sécurité, corrections appliquées et vérifiées, PWA, refonte visuelle.
`../docs/01-AUDIT-WEB.md` garde le plan en trois jalons d'origine.

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

1. **Textes juridiques faux.** Les CGU affirment toujours que la plateforme
   n'encaisse aucun paiement — faux depuis le 18 août 2026, et la commission de
   10–20 % n'y figure nulle part. Quatre passages dans
   `src/pages/legal/contenu.ts` (lignes 7, 90, 203, 231). Le drapeau
   `TEXTES_PROVISOIRES` est à `false` : les textes se présentent comme
   définitifs alors qu'ils décrivent une plateforme qui n'existe plus.
   **En cours de réécriture par le juriste.**

**Chantiers restants, par valeur :**

2. Boutique d'œuvres d'art — décidée le 12 août 2026, rien n'existe encore.
3. Décaissement automatique vers Wave / Orange Money — **suspendu à une
   activation PayDunya à demander**. Le suivi des reversements existe déjà (voir
   plus bas) ; seul le virement reste un geste humain.

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
