# Ma Villa — Audit web avant lancement

_Analyse du 8 août 2026 · périmètre : `Ma-Villa/` (React) + `backend/` (Laravel) pour ce qui conditionne le web._

> **Mise à jour du 9 août 2026 — le Jalon 1 (§7) a été appliqué.**
> Détail des corrections dans `04-CORRECTIONS-APPLIQUEES.md`. Le corps de ce document
> décrit l'état **avant** correction : il reste la référence sur le *pourquoi* de chaque
> décision. Ce qui reste ouvert est listé au §7, Jalons 2 et 3.

---

## 0. Verdict en une page

La plateforme est **fonctionnellement complète en tant que vitrine** : inscription, publication de villa, logements, tarifs, photos, réservation avec détection de conflit, avis, favoris, modération admin. Le code TypeScript compile sans erreur, les policies existent, il y a des tests Feature côté Laravel. Ce n'est pas un prototype.

Mais **ce n'est pas encore une marketplace**, pour cinq raisons qui bloquent toutes le lancement commercial :

| # | Blocage | Conséquence business |
|---|---|---|
| 1 | **Le prix n'apparaît jamais sur les listings** | Le visiteur parcourt une grille de villas sans savoir combien elles coûtent. |
| 2 | **Aucun paiement** (modèle `Paiement` présent, 0 route, 0 UI) | La transaction sort de la plateforme → WhatsApp/téléphone, exactement le problème que le projet veut résoudre. Aucun revenu captable. |
| 3 | **Aucune notification** (0 mail, 0 SMS) | Une demande de réservation meurt en silence si le propriétaire n'ouvre pas son dashboard. |
| 4 | **Aucune réinitialisation de mot de passe** | Tout utilisateur qui perd son mot de passe est définitivement perdu. |
| 5 | **Pas de pages légales (CGU, confidentialité)** | Bloquant pour ouvrir un compte marchand Wave / Orange Money / PayDunya. |

À côté de ça, deux fuites sécurité à corriger avant d'ouvrir au public (§2), et un problème de poids d'assets spécifiquement pénalisant sur data mobile sénégalaise (§3).

Le design, lui, n'est pas « mauvais » — la direction artistique (sable/terracotta + serif éditorial) est juste et différenciante. Le problème est **systémique** : il n'y a pas de système. Détail en §6, et c'est le sujet du document `03-PROMPT-CLAUDE-DESIGN.md`.

---

## 1. Architecture actuelle

```
Ma Villa Project/
├── Ma-Villa/        React 19 · Vite 8 · TypeScript 6 · Tailwind v4 · React Router 7 · axios
├── backend/         Laravel 11 · Sanctum · MySQL · 10 modèles · Docker
├── mobile/          Expo / React Native
└── docker/, render.yaml   déploiement : Render (static) + Railway (API)
```

**Front web — 36 fichiers, ~4 900 lignes.**

| Zone | Routes | Fichiers |
|---|---|---|
| Public | `/`, `/villas`, `/villas/:id`, `/login`, `/register` | `App.tsx`, `pages/public/`, `pages/Login|Register` |
| Espace client / propriétaire | `/dashboard/*` (7 sous-routes) | `pages/dashboard/` (1 823 l.) |
| Back-office admin | `/admin/*` (4 sous-routes) | `pages/admin/` (739 l.) |

**Backend — 30 endpoints**, dont 8 admin. Policies sur `Villa` et `Reservation`, middleware `admin`, tests Feature sur Auth / Villa / Reservation / Favori / Admin.

**Ce qui est solide et qu'il ne faut pas casser :**
- Le modèle métier villa → logements → tarifs (journée / nuitée / demi-journée / pass × clim × buffet) est le vrai avantage produit sur Airbnb. Il est bien modélisé.
- La détection de conflit de dates dans `ReservationController@store` est correcte (les 3 cas de chevauchement sont couverts).
- Le workflow de modération admin (`en_attente` → `validee`) existe et fonctionne.
- Les tokens de design CSS (`--accent`, `--text-1`, `--shadow-*`) sont bien pensés — ils sont juste massivement contournés.

---

## 2. Sécurité — à corriger avant ouverture publique

### 2.1 🔴 Fuite de données : `GET /api/reservations/{id}` sans autorisation

`backend/app/Http/Controllers/Api/ReservationController.php:64`

```php
public function show(Reservation $reservation): JsonResponse
{
    return response()->json($reservation->load(['logement.villa', 'tarif', 'paiement']));
}
```

Aucun `$this->authorize()`. **N'importe quel utilisateur connecté peut lire la réservation de n'importe qui** en incrémentant l'ID : nom du client, email, dates de séjour, montant. `updateStatut()` juste en dessous, lui, appelle bien `authorize('update', ...)` — c'est un oubli, pas un choix.

→ Ajouter une méthode `view` à `ReservationPolicy` et l'appeler.

### 2.2 🔴 Villas non validées consultables publiquement

`routes/api.php:21` — `GET /villas/{villa}` utilise le binding implicite sans filtre de statut. `index()` filtre bien sur `statut = validee`, mais `show()` non. Une villa `en_attente` ou `rejetee` reste accessible par son ID, ce qui vide de sens la modération admin.

→ Ajouter un scope (`->where('statut','validee')`) ou une vérification, avec exception pour le propriétaire et l'admin (utile pour la prévisualisation).

### 2.3 🟠 CORS ouvert à tout le monde

`backend/config/cors.php` — `'allowed_origins' => ['*']`. À restreindre au domaine web de production + l'origine mobile.

### 2.4 🟠 Avis sans preuve de séjour

`AvisController@store` ne valide que `villa_id`, `note`, `commentaire`. Aucune vérification qu'une réservation confirmée existe. Conséquences : faux avis, avis de concurrents, et rien n'empêche un propriétaire de noter sa propre villa. Le `updateOrCreate` limite bien à 1 avis par utilisateur et par villa — c'est le seul garde-fou.

Or la note moyenne est **le** signal de confiance affiché partout (`VillaCard`, fiche villa). Sur une marketplace naissante, un système d'avis manipulable détruit la crédibilité plus vite qu'il ne la construit.

→ Exiger une réservation `confirmee` et passée sur un logement de la villa.

### 2.5 🟡 Upload de 100 Mo autorisé, sans traitement

`PhotoController@upload` : `max:102400` (100 Mo), stockage brut dans `storage/public/uploads`, aucun redimensionnement, aucune conversion. Un propriétaire qui envoie 8 photos de smartphone met en ligne ~50 Mo qui seront re-téléchargés tels quels par chaque visiteur.

### 2.6 🟡 Token en `localStorage`

Choix classique et acceptable pour un MVP, mais il rend le token lisible par n'importe quel XSS. À noter dans le registre des risques ; migration vers cookie `httpOnly` + Sanctum SPA à envisager après lancement.

---

## 3. Performance — le sujet critique sur ce marché

Le bundle JS n'est **pas** le problème : 119 Ko gzip pour le JS, 10 Ko pour le CSS. C'est correct.

Le problème, ce sont les médias.

| Asset | Poids | Usage réel |
|---|---|---|
| `public/logo.png` | **2,0 Mo** | Affiché en **36 × 36 px** dans la navbar, et comme favicon |
| `public/video_backgroud.mp4` | **5,0 Mo** | Autoplay en fond sur **toutes les routes sauf la home**, y compris `/login`, `/dashboard`, `/admin` — derrière un voile opaque |

**7 Mo de décoration** sur un marché où la connexion est majoritairement mobile et la data payée au volume. Le logo à lui seul, c'est ~2 Mo pour afficher un carré de 36 px : un PNG de 96 px suffirait (~8 Ko), soit **250× moins**.

Autres points :

- `VideoBackground` (`App.tsx:62`) monte une `<video>` en autoplay sur chaque route non-home. Un propriétaire qui gère ses tarifs télécharge 5 Mo de vidéo décorative.
- La vidéo du hero de la home pointe vers **une URL CloudFront tierce** héritée du template de départ :
  `d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260403_...mp4`
  Dépendance externe non maîtrisée : elle peut disparaître sans préavis, et rien ne documente les droits d'usage commercial. **À remplacer par un asset dont vous êtes propriétaire avant lancement.**
- Aucun code-splitting : les routes `/admin/*` et `/dashboard/*` sont dans le bundle initial alors que la grande majorité des visiteurs ne les verra jamais. `React.lazy` + `Suspense` sur ces deux arbres est un gain immédiat.
- Photos de villa servies brutes : pas de `srcset`, pas de WebP/AVIF, `loading="lazy"` présent sur 3 images sur 9.
- `babel-plugin-react-compiler` et `@rolldown/plugin-babel` sont installés mais **non branchés** dans `vite.config.ts`. Soit on les active, soit on les retire.

---

## 4. SEO et partage — quasi inexistant

`Ma-Villa/index.html` :

- `<html lang="en">` — le site est intégralement en français.
- **Aucune** `<meta name="description">`.
- **Aucune** balise Open Graph ni Twitter Card.
- Pas de `robots.txt`, pas de `sitemap.xml`, pas de JSON-LD.
- Le `<title>` est fixe pour toutes les routes : une fiche villa s'affiche « Ma Villa — Villas de luxe au Sénégal ».
- URLs numériques : `/villas/12` au lieu de `/villas/saly-villa-des-palmiers-12`.

**Ce que ça coûte concrètement.** Le canal de partage dominant sur ce marché, c'est WhatsApp. Aujourd'hui, un client qui envoie le lien d'une villa à sa famille envoie **une URL nue** : pas de photo, pas de titre, pas de prix dans l'aperçu. C'est la boucle de croissance la moins chère du produit, et elle est cassée.

Et comme c'est une SPA sans SSR ni prerender, Google ne verra à peu près aucun contenu de fiche villa.

→ Deux chantiers : (a) meta dynamiques par route, (b) prerender au build ou SSR. Pour une SPA Vite, `vite-plugin-ssg` ou un prerender des fiches villa au build est le chemin le plus court.

---

## 5. Écarts fonctionnels vs le document de référence v2

Le document `Ma_Villa_Document_Reference_v2.docx` définit le périmètre cible. Voici ce qui manque.

| Fonction prévue | État | Impact |
|---|---|---|
| Paiement Wave / Orange Money | ❌ Table + modèle seuls | **Bloquant** — c'est l'avantage concurrentiel n°1 annoncé |
| Notifications (résa, paiement, rappel) | ❌ Aucun `app/Notifications`, aucun `app/Mail` | **Bloquant** — la boucle de réservation ne se ferme pas |
| Réinitialisation mot de passe par email | ❌ | **Bloquant** |
| Vérification email | ❌ `email_verified_at` au schéma, jamais utilisé | La home promet « Propriétaires vérifiés » — promesse non tenue |
| Filtre par disponibilité à des dates précises | ❌ Backend prêt (`disponibilites` + détection conflit), non exposé | C'est **la** question n°1 du client. Aujourd'hui il choisit ses dates à l'aveugle et découvre le conflit en 409 après soumission |
| Filtre par note | ❌ | |
| Carte interactive avec marqueurs sur la recherche | ❌ Seulement une iframe OSM sur la fiche | Prévu au doc, fort pour Saly/Mbour |
| Géolocalisation automatique | ❌ | |
| Statistiques propriétaire (revenus, taux d'occupation) | ❌ Le dashboard compte les villas et les demandes en attente | Argument de rétention propriétaire |
| Messagerie client ↔ propriétaire | ❌ | |
| OAuth Google | ❌ (marqué optionnel au doc) | |
| Pages légales (CGU, confidentialité, annulation) | ❌ | **Bloquant** pour les agrégateurs de paiement |

**Un manque qui n'est pas au document mais qui compte autant :** il n'y a **pas de barre de recherche sur la page d'accueil**. Le hero propose « Voir les villas » et « Publier ma villa ». Le visiteur arrive sur `/villas` et doit ensuite comprendre qu'il y a un panneau de filtres. Sur toute marketplace de séjour, le bloc *destination + dates + voyageurs* est l'élément central du hero — c'est le point d'entrée du parcours.

---

## 6. Cohérence & qualité front

### 6.1 🔴 Le prix et les équipements ne s'affichent jamais

`components/VillaCard.tsx` attend `prix_min`, `capacite`, `piscine`, `wifi`.

`VillaController@index` renvoie `Villa::with(['photos','avis'])` — et le modèle `Villa` n'a **ni ces colonnes ni d'accesseur** correspondant. Conséquence : le badge prix (ligne 80) et toute la barre d'équipements (ligne 148) sont dans du code mort. La grille affiche des villas **sans prix**.

Le filtre « Prix min / Prix max » de `/villas` fonctionne bien côté serveur — mais l'utilisateur filtre sur un prix qu'il ne verra jamais affiché.

C'est le bug le plus coûteux du produit et il est invisible : rien ne plante, la carte se contente d'omettre les blocs.

→ Ajouter au `index()` : `withMin('logements.tarifs','prix')`, `withAvg('avis','note')`, `withCount('avis')`, et une capacité max. Puis aligner l'interface TypeScript.

### 6.2 Deux en-têtes, deux identités de marque

- `components/Navbar.tsx` — home uniquement : verre translucide, `logo.png` + wordmark en Cormorant Garamond.
- `components/PageHeader.tsx` — `/villas`, `/villas/:id` : sticky opaque, **pas de logo**, wordmark en DM Sans `font-semibold`.

La marque change d'apparence entre la page d'accueil et la page suivante. Deux composants à maintenir en parallèle pour la même fonction (dont les mêmes 4 icônes SVG dupliquées).

### 6.3 Pas de composants primitifs

Aucun `<Button>`, `<Input>`, `<Card>`, `<Badge>`, `<Modal>` réutilisable. Résultat : **au moins 4 styles de bouton primaire coexistent**.

| Écran | Fond du bouton principal |
|---|---|
| Hero home | `#fff` sur texte `stone-900` |
| `/villas` — « Rechercher » | `var(--accent)` |
| `/villas` — pagination active | `var(--text-1)` |
| `/login` | dégradé `accent → accent-warm` + `btn-shimmer` |
| Fiche villa — « Réserver » | `var(--text-1)` |

Le bouton d'action le plus important du site (« Réserver ») n'utilise pas la couleur d'accent de la marque.

### 6.4 Deux systèmes de style en parallèle

- **365** blocs `style={{…}}` inline dans le front.
- **15** couleurs hexadécimales et **35** `rgba()` codées en dur, hors tokens.

Le système de tokens existe et est bon — mais Tailwind sert au layout et le CSS inline sert à la couleur. Toute modification de palette demande une passe manuelle sur 36 fichiers.

### 6.5 Quatre états de thème maintenus à la main

La classe `html.video-mode` (`index.css:338-379`) **réécrit une vingtaine de tokens** selon la route. Le thème n'a donc pas 2 états mais 4 : clair, sombre, clair + vidéo, sombre + vidéo. Chacun avec sa propre table de couleurs recopiée. C'est une source garantie de dérive.

### 6.6 Accessibilité — contrastes mesurés

Ratios WCAG calculés sur les tokens réels :

| Paire | Ratio | Verdict |
|---|---|---|
| `--text-3` `#A09890` sur `--bg` `#F7F4EF` (clair) | **2,59:1** | ❌ Échec, même en grand texte |
| `--text-3` `#A09890` sur blanc (clair) | **2,84:1** | ❌ Échec |
| Blanc sur `--accent` `#C4622D` (bouton) | **4,09:1** | ❌ Échec AA texte normal |
| `--accent` `#C4622D` sur `--bg` (clair) | **3,73:1** | ❌ Échec AA texte normal — or il sert aux libellés `text-xs` (« Sélection », « Toutes les annonces ») |
| `--text-3` `#7A7470` sur `--bg-surface` (sombre) | 4,04:1 | ⚠️ Grand texte seulement |
| `--text-2` clair et sombre | 5,24 / 4,98:1 | ✅ AA |
| `--accent` `#E8845A` sur `--bg` (sombre) | 7,42:1 | ✅ AA |

Le thème sombre est presque bon. **Le thème clair — celui par défaut — échoue sur ses couleurs de texte tertiaire et sur son accent.** À corriger dans la refonte : `--text-3` et l'accent clair doivent être assombris.

Autres points : `data-theme` initialisé en dur à `light` sans lire `prefers-color-scheme` ; `AnimatedHeading` découpe le `<h1>` en dizaines de `<span>` (mauvais pour lecteurs d'écran et copier-coller) ; 9 attributs `aria-*` sur tout le front.

### 6.7 Gestion d'erreur invisible

**11 occurrences de `.catch(() => {})`** — l'erreur est avalée sans trace. Aucun système de toast, aucun `ErrorBoundary`, aucun état d'erreur dans les pages. Si l'API tombe, l'utilisateur voit un écran vide sans explication et sans moyen de réessayer.

### 6.8 Points de détail

- `CurtainTransition` : rideau noir plein écran de 720 ms à **chaque** navigation → +0,7 s perçue par clic.
- `VillaCard` en ratio 3/4 avec nom + ville en surimpression sur la photo : lisibilité dépendante de la luminosité de chaque photo.
- `Ma-Villa/CLAUDE.md` décrit encore le projet **« VEX Hero »** — obsolète, il oriente à faux toute session d'agent qui le lit. À réécrire.
- `src/assets/react.svg`, `vite.svg`, `hero.png` : résidus du template.

---

## 7. Plan de lancement proposé

### Jalon 1 — « Ne pas ouvrir sans ça » (~1 à 2 semaines)

1. Exposer `prix_min` / note moyenne / capacité dans `VillaController@index` → les cartes affichent enfin un prix. **(§6.1)**
2. `authorize` sur `ReservationController@show` + filtre `statut` sur `villas/{id}`. **(§2.1, §2.2)**
3. Réinitialisation de mot de passe + vérification email.
4. Notifications email : nouvelle demande → propriétaire ; confirmation/refus → client.
5. Compresser `logo.png` (2 Mo → ~10 Ko), retirer `VideoBackground` des routes applicatives, remplacer la vidéo CloudFront tierce par un asset détenu. **(§3)**
6. Meta description + Open Graph dynamiques + `lang="fr"` → les partages WhatsApp affichent enfin un aperçu. **(§4)**
7. Pages CGU / confidentialité / politique d'annulation.
8. Restreindre le CORS.

### Jalon 2 — « Marketplace » (~2 à 4 semaines)

9. Paiement Wave + Orange Money (acompte ou paiement intégral) et statut de paiement sur la réservation.
10. Recherche par dates réellement disponibles, exposée dès la home dans un bloc *destination + dates + voyageurs*.
11. Avis conditionnés à un séjour confirmé et passé. **(§2.4)**
12. Système de toasts + `ErrorBoundary` + états d'erreur. **(§6.7)**
13. **Refonte du design system** → objet du document `03-PROMPT-CLAUDE-DESIGN.md`.

### Jalon 3 — « Croissance »

14. Prerender / SSR des fiches villa + sitemap + URLs avec slug.
15. Carte interactive à marqueurs sur la recherche.
16. Statistiques propriétaire (revenus, taux d'occupation).
17. Messagerie client ↔ propriétaire.
18. Optimisation des images à l'upload (redimensionnement + WebP).

---

## 8. Fichiers cités

| Sujet | Fichier |
|---|---|
| Prix absent des cartes | `Ma-Villa/src/components/VillaCard.tsx:80` · `backend/app/Http/Controllers/Api/VillaController.php:14` |
| IDOR réservation | `backend/app/Http/Controllers/Api/ReservationController.php:64` |
| Villa non validée exposée | `backend/routes/api.php:21` |
| CORS ouvert | `backend/config/cors.php` |
| Avis sans preuve de séjour | `backend/app/Http/Controllers/Api/AvisController.php` |
| Vidéo sur toutes les routes | `Ma-Villa/src/App.tsx:62` |
| Vidéo CloudFront tierce | `Ma-Villa/src/App.tsx:316` |
| Tokens & 4 états de thème | `Ma-Villa/src/index.css:10-62`, `:338-379` |
| Doublon d'en-tête | `Ma-Villa/src/components/Navbar.tsx` · `Ma-Villa/src/components/PageHeader.tsx` |
| Meta / SEO | `Ma-Villa/index.html` |
| CLAUDE.md obsolète | `Ma-Villa/CLAUDE.md` |
