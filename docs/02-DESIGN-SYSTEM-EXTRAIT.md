# Ma Villa — Design system extrait de l'existant

_Relevé exhaustif de ce qui est réellement implémenté dans `Ma-Villa/src`, au 8 août 2026._
_Sert de base au brief de refonte (`03-PROMPT-CLAUDE-DESIGN.md`). Ce qui est marqué ⚠️ est à corriger, pas à reproduire._

---

## 1. Identité

| | |
|---|---|
| **Nom** | Ma Villa |
| **Baseline actuelle** | « Votre villa de rêve au Sénégal. » |
| **Sous-titre hero** | « Découvrez des villas, appartements et maisons d'exception à Saly, Dakar, Mbour et partout au Sénégal. » |
| **Villes signature** | Dakar · Saly · Mbour (+ Ziguinchor) |
| **Langue** | Français exclusivement |
| **Devise** | FCFA, formatée `fr-FR` (`120 000 FCFA`) |
| **Logo** | `public/logo.png` ⚠️ 2 Mo, affiché en 36 × 36 px |
| **Wordmark** | « Ma Villa » en Cormorant Garamond 400, `letter-spacing: -0.02em` ⚠️ mais en DM Sans `font-semibold` dans `PageHeader` |

**Univers visuel actuel :** sable chaud, terre cuite, or. Registre éditorial/hôtelier plutôt que « tech ». Vidéo en fond, verre translucide, animations d'entrée soignées.

---

## 2. Couleur

### 2.1 Thème clair (défaut)

| Token | Valeur | Rôle |
|---|---|---|
| `--bg` | `#F7F4EF` | Fond de page — sable très clair |
| `--bg-surface` | `#FFFFFF` | Cartes, panneaux |
| `--bg-elevated` | `#F0EDE6` | Encarts internes, stat cards |
| `--bg-input` | `rgba(0,0,0,.04)` | Champs de formulaire |
| `--text-1` | `#1A1614` | Texte principal — brun-noir, pas du noir pur |
| `--text-2` | `#6B6560` | Texte secondaire — ✅ 5,24:1 |
| `--text-3` | `#A09890` | Texte tertiaire — ⚠️ **2,59:1, échec WCAG** |
| `--border` | `rgba(0,0,0,.07)` | Bordure standard |
| `--border-2` | `rgba(0,0,0,.14)` | Bordure appuyée |
| `--accent` | `#C4622D` | Terracotta — ⚠️ **3,73:1 sur `--bg`, échec en texte courant** |
| `--accent-warm` | `#E8845A` | Terracotta clair (dégradés) |
| `--accent-gold` | `#D4A843` | Or — badges « Vedette », avatars |
| `--accent-bg` | `rgba(196,98,45,.10)` | Fond de pastille d'icône |
| `--success` | `#22875A` | |
| `--warning` | `#D97706` | |
| `--danger` | `#DC2626` | |
| `--header-bg` | `rgba(247,244,239,.88)` | En-tête sticky (avec blur) |
| `--glass-bg` | `rgba(255,255,255,.72)` | Verre |

### 2.2 Thème sombre

| Token | Valeur | Note |
|---|---|---|
| `--bg` | `#0C0A08` | Presque noir, teinté chaud |
| `--bg-surface` | `#161210` | |
| `--bg-elevated` | `#1E1A17` | |
| `--text-1` | `#F5F0EB` | Blanc cassé chaud |
| `--text-2` | `#8A837D` | ✅ 4,98:1 |
| `--text-3` | `#7A7470` | ⚠️ 4,04:1 — grand texte seulement |
| `--border` | `rgba(255,240,220,.08)` | Bordure teintée chaud |
| `--accent` | `#E8845A` | ✅ 7,42:1 — le thème sombre est mieux calibré |
| `--accent-gold` | `#E8C060` | |
| `--success` / `--warning` / `--danger` | `#34D399` / `#FBBF24` / `#F87171` | |

### 2.3 ⚠️ Les deux états supplémentaires

`html.video-mode` (appliqué sur **toutes les routes sauf `/`**) réécrit une vingtaine de tokens pour compenser la vidéo de fond. Combiné à `[data-theme]`, cela produit **4 tables de couleurs distinctes maintenues à la main** : clair, sombre, clair+vidéo, sombre+vidéo.

C'est le principal défaut structurel de la couleur. **À supprimer dans la refonte** : le fond vidéo doit être un composant local, pas un mode global de thème.

### 2.4 ⚠️ Couleurs hors système

15 hexadécimaux et 35 `rgba()` codés en dur dans les composants. Les plus fréquents :

- `rgba(255,255,255,.10 → .25)` — verre sur photo/vidéo (hero, badges de carte)
- `rgba(0,0,0,.45 → .60)` — pastilles de contrôle sur photo (favori, flèches de galerie)
- `#ef4444` — cœur favori actif (ne passe pas par `--danger`)
- `#FBBF24` — étoiles de notation (ne passe pas par `--warning`)
- `linear-gradient(135deg,#C4846A,#D4B896,#A8C5D0)` — placeholder de villa sans photo (seule occurrence d'un bleu-gris dans tout le produit)

---

## 3. Typographie

Chargées via Google Fonts dans `index.html`.

| Rôle | Police | Graisses | Réglages |
|---|---|---|---|
| **Display** | Cormorant Garamond (serif) | 300, 400, 500, 600 + italiques 300/400 | `letter-spacing: -0.04em`, `line-height: 1.08`, graisse 300 |
| **Interface** | DM Sans | 300, 400, 500, 600, 700 | Défaut du `body` |

**Usages du serif :** titre hero, wordmark, valeurs de statistiques (`.stat-value`), titres de dashboard, encart « Dakar. Saly. Mbour. ».
**Tout le reste** est en DM Sans.

**Échelle constatée** (Tailwind, non formalisée) :

| Emploi | Classes |
|---|---|
| Titre hero | `text-4xl md:text-5xl lg:text-6xl xl:text-7xl` · `font-light` |
| Titre de section | `text-3xl md:text-4xl` · `font-normal` · `-0.02em` |
| Titre de page | `text-2xl md:text-3xl` |
| Sous-titre | `text-lg` / `text-base md:text-lg` |
| Corps | `text-sm` |
| Libellé / méta | `text-xs` |
| Sur-titre (« eyebrow ») | `text-xs uppercase tracking-widest font-medium` en `--accent` ⚠️ contraste insuffisant |

⚠️ Aucune échelle typographique déclarée en tokens : chaque page recompose ses tailles.

---

## 4. Formes, ombres, profondeur

**Rayons** — pas de tokens, valeurs Tailwind directes :

| Valeur | Emploi |
|---|---|
| `rounded-lg` (8 px) | Petits badges |
| `rounded-xl` (12 px) | Boutons, champs, pastilles d'icône, liens de sidebar |
| `rounded-2xl` (16 px) | Cartes, panneaux, modales, barre de navigation |
| `rounded-full` | Pastilles de notation, avatars, points de pagination |

**Ombres** — 5 tokens, avec des valeurs distinctes clair/sombre :

```
--shadow-sm    0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)
--shadow-md    0 4px 16px rgba(0,0,0,.08), 0 2px 6px rgba(0,0,0,.05)
--shadow-lg    0 12px 40px rgba(0,0,0,.12), 0 4px 12px rgba(0,0,0,.06)
--shadow-xl    0 24px 64px rgba(0,0,0,.16), 0 8px 24px rgba(0,0,0,.08)
--shadow-accent 0 8px 24px rgba(196,98,45,.40), 0 2px 8px rgba(196,98,45,.20)
```

**Verre** — 4 variantes concurrentes ⚠️ :
`.liquid-glass` (blur 20 + saturate 180 + liseré dégradé en `::before`), `.glass-hero-light`, `.glass-card-dark`, `.glass-modal`. Plus des `backdropFilter` inline dans `Navbar`, `VillaCard`, `Hero`.

---

## 5. Espacement & mise en page

| | |
|---|---|
| **Gouttière de page** | `px-6 md:px-12 lg:px-16` (vitrine) · `px-6` (pages internes) · `px-5 py-7 lg:px-10 lg:py-10` (dashboard) ⚠️ trois conventions |
| **Largeur max** | `max-w-6xl` (home, `/villas`) · `max-w-5xl` (fiche villa) · `max-w-md` (auth) |
| **Rythme vertical** | `py-20` entre sections vitrine · `mb-8` / `mb-10` entre blocs |
| **Grille de cartes** | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6` |
| **Sidebar dashboard** | 240 px fixes, sticky pleine hauteur, bascule en tiroir sous `lg` |
| **Breakpoints** | Tailwind par défaut — `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280 |

---

## 6. Composants existants

### 6.1 Réutilisables (`src/components/`)

| Composant | Rôle |
|---|---|
| `VillaCard` | Carte de villa — photo 3/4, dégradé, badges vedette/prix, bouton favori, nom+ville en surimpression, pied avec description et équipements |
| `Navbar` | En-tête de la home — verre, transparent sur le hero, opaque après 60 px de scroll |
| `PageHeader` | En-tête des autres pages publiques ⚠️ doublon fonctionnel de `Navbar`, identité différente |
| `Hero` | Bloc hero avec titre animé, sous-titre, 2 CTA, encart villes |
| `AnimatedHeading` | Titre animé caractère par caractère ⚠️ découpe le `<h1>` en dizaines de `<span>` |
| `FadeIn` | Apparition en opacité, `delay`/`duration` paramétrables |
| `ScrollReveal` | `IntersectionObserver` → ajoute `.sr-visible`, gère l'effet en cascade |
| `Skeleton` | `Skeleton`, `VillaCardSkeleton`, `StatCardSkeleton` — shimmer |
| `FloatingInput` | Champ à libellé flottant, avec `rightElement` |
| `ConfirmModal` | Modale de confirmation |

### 6.2 ❌ Primitifs manquants

Pas de `Button`, `Input`, `Select`, `Card`, `Badge`, `Modal`, `Toast`, `EmptyState`, `Avatar`, `Pagination`, `Tabs`, `Tooltip`, `Spinner`.

Conséquence mesurée : **au moins 4 styles de bouton primaire coexistent** (blanc, `--accent`, `--text-1`, dégradé). Le bouton « Réserver » — l'action la plus importante du produit — utilise `--text-1`, pas la couleur de marque.

### 6.3 Classes utilitaires CSS

`.th-bg` `.th-surface` `.th-elevated` `.th-input` `.th-text-1/2/3` `.th-border` `.th-border-2` `.th-accent` `.th-accent-bg` `.th-card` `.th-input-field` — un pont vers les tokens, mais appliqué de façon inégale (365 `style={{}}` inline en parallèle).

**Badges** : `.badge` + `.badge-success|warning|danger|gold`, avec `.badge-dot` — bien conçu, sous-utilisé (`Reservations.tsx` refait ses badges en Tailwind brut).

**Navigation de sidebar** : `.sidebar-link` / `.sidebar-link.active` — barre d'accent gauche 2 px + dégradé horizontal `--accent-bg → transparent`. Le motif le plus abouti du système.

---

## 7. Mouvement

| Effet | Détail |
|---|---|
| `.curtain` | Rideau plein écran `#1A1614`, balayage vertical 720 ms `cubic-bezier(.76,0,.24,1)` à chaque navigation ⚠️ +0,7 s perçue par clic |
| `.sr-init` / `.sr-visible` | Révélation au scroll — 28 px + opacité, 650 ms |
| `.sr-stagger` | Cascade sur les enfants, 80 ms d'écart, plafonnée à 480 ms |
| `.card-lift` | `translateY(-6px)` + `--shadow-xl`, 320 ms `cubic-bezier(.34,1.56,.64,1)` (rebond) |
| `.btn-shimmer` | Reflet diagonal traversant au survol, 600 ms |
| `.ken-burns` / `-2` | Zoom-panoramique lent 22 s / 25 s |
| `.pulse-accent` | Halo pulsé 2 s |
| `.skeleton` | Shimmer 1,8 s |
| `.animate-slide-up` / `.animate-scale-in` / `.card-enter` | Entrées de modale et de carte |
| Photo de carte | `scale(1.10)` au survol, 700 ms |

**Courbes récurrentes :** `cubic-bezier(.25,.46,.45,.94)` (sortie douce) et `cubic-bezier(.34,1.56,.64,1)` (rebond).

✅ `@media (prefers-reduced-motion: reduce)` est présent et couvre l'essentiel.

---

## 8. Motifs d'interface

| Motif | Implémentation actuelle |
|---|---|
| **Chargement** | Squelettes sur `/villas` ; spinner circulaire ailleurs ⚠️ incohérent |
| **État vide** | Icône dans un carré `rounded-2xl` + titre + sous-titre + action de réinitialisation — bien fait sur `/villas`, absent ailleurs |
| **Erreur** | Encart `bg-red-500/10 border-red-500/20` ⚠️ classes Tailwind brutes, hors tokens. Et **11 erreurs avalées en silence** |
| **Succès** | Encart vert, ou emoji ✅ + texte (fiche villa) |
| **Pagination** | Numérotée avec ellipses, flèches ← → |
| **Galerie** | Carrousel 16/9 + miniatures + lightbox plein écran (Échap / ← / →), gère image **et** vidéo |
| **Progression de lecture** | Barre 2 px en haut de la fiche villa |
| **Réservation mobile** | Barre d'action fixe en bas avec « Réserver » |
| **Notation** | ★ en `#FBBF24`, moyenne + nombre d'avis |

---

## 9. Structure de l'application

```
PUBLIC
  /                    Home — hero vidéo, villas en vedette (3), 3 arguments, pied de page
  /villas              Recherche — filtres (ville, prix min/max, type) + grille + pagination
  /villas/:id          Fiche — galerie, infos, contact, carte OSM, logements+tarifs, avis, panneau de réservation
  /login  /register    Authentification
  *                    404

CLIENT / PROPRIÉTAIRE  (/dashboard — sidebar 240 px)
  /                    Accueil — statistiques + accès rapides
  /villas              Mes villas                    (propriétaire)
  /villas/nouvelle     Création de villa             (propriétaire)
  /villas/:id          Gestion : logements, tarifs, photos, disponibilités (712 lignes)
  /reservations        Demandes — confirmer / refuser
  /favoris             Favoris                       (client)
  /profil              Profil

ADMIN  (/admin)
  /                    Statistiques globales
  /villas              Validation, mise en vedette
  /utilisateurs        Gestion
  /avis                Modération
```

---

## 10. Synthèse — à garder / à jeter

### ✅ À conserver dans la refonte

- **La palette sable / terracotta / or.** Chaleureuse, ancrée localement, différenciante face au bleu générique du secteur. C'est un capital de marque réel.
- **L'appariement Cormorant Garamond + DM Sans.** Registre éditorial haut de gamme, cohérent avec la promesse.
- **L'architecture de tokens CSS.** Bien nommée, complète, seulement mal appliquée.
- **`.sidebar-link`**, le système de `.badge`, les squelettes, la lightbox (image + vidéo), la barre de réservation mobile.
- **Le vocabulaire métier** : villa → logements → formules tarifaires (journée / nuitée / demi-journée / pass × clim × buffet). C'est l'avantage produit sur Airbnb, il doit rester visible dans l'interface.
- **`prefers-reduced-motion`.**

### ❌ À éliminer

- Le mode `video-mode` et ses 4 tables de couleurs — le fond vidéo doit être local, pas global.
- Le doublon `Navbar` / `PageHeader` — un seul en-tête, deux variantes.
- Les 365 `style={{}}` inline et les 50 couleurs hors tokens.
- Le rideau de transition de 720 ms.
- Les 4 variantes de verre.
- L'animation caractère par caractère du `<h1>`.
- La vidéo CloudFront tierce (5 Mo) et le logo de 2 Mo.

### 🔧 À corriger

- `--text-3` clair (2,59:1) et `--accent` clair (3,73:1, et 4,09:1 en fond de bouton) → assombrir jusqu'à AA.
- Un seul bouton primaire, dans la couleur de marque, pour l'action « Réserver ».
- Le prix doit apparaître sur la carte de villa (nécessite aussi le correctif API — voir `01-AUDIT-WEB.md` §6.1).
- Détection de `prefers-color-scheme` au premier chargement.
- Une seule convention de gouttière et une échelle typographique déclarée.
