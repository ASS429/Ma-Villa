# VEX Hero — Contexte projet pour Claude Code

> Ce fichier est ton point d'entrée. Lis-le avant toute action. Il contient le spec, l'état actuel, les prochaines étapes et les conventions de travail.

---

## 🎯 Objectif

Recréer à l'identique une section **hero** en React + TypeScript + Tailwind CSS, d'après un spec de design détaillé (voir section "Spec original" plus bas).

L'utilisateur a commencé l'implémentation avec Claude via chat web, et passe maintenant à Claude Code dans VS Code pour continuer. **Il faut reprendre exactement où on en est.**

---

## 🗣️ Conventions de communication

- **Parle en français.** L'utilisateur est francophone.
- **Avance pas à pas.** Une étape à la fois, validation de l'utilisateur avant de passer à la suivante.
- **Test local avant push.** Ne rien pousser sur un repo distant pour l'instant — on reste en local tant que l'utilisateur ne l'a pas demandé.
- **Pas de sur-ingénierie.** Le projet est une seule page avec une seule section hero. Pas besoin de routing, de store global, etc.

---

## ✅ État actuel (ce qui est DÉJÀ fait)

### Étape 1 — Projet Vite initialisé ✅
- `npm create vite@latest vex-hero -- --template react-ts`
- `npm install` effectué
- `npm run dev` testé et fonctionnel

### Étape 2 — Tailwind CSS v4 configuré ✅
- Paquets installés : `tailwindcss` et `@tailwindcss/vite`
- `vite.config.ts` : plugin `tailwindcss()` ajouté
- `src/index.css` : contient uniquement `@import "tailwindcss";`
- `src/App.css` : **supprimé**
- `src/App.tsx` : contient un placeholder temporaire `<h1>Tailwind fonctionne ✅</h1>` sur fond noir
- `src/main.tsx` : plus d'import de `App.css`

⚠️ **IMPORTANT — Tailwind v4 ≠ Tailwind v3.** Il n'y a **pas** de fichier `tailwind.config.js`. Toute la config (thème, polices, couleurs personnalisées) se fait **dans le CSS** via la directive `@theme`. Exemple pour configurer Inter :

```css
@import "tailwindcss";

@theme {
  --font-sans: "Inter", sans-serif;
}
```

Avec ça, `font-sans` de Tailwind pointera automatiquement sur Inter. Ne JAMAIS proposer un `tailwind.config.js` — ça ne marchera pas avec cette version.

---

## 🗺️ Étapes restantes (à faire dans cet ordre)

### Étape 3 — Police Inter + styles globaux + `.liquid-glass` ⏭️ **PROCHAINE**
1. Dans `index.html` (à la racine, pas dans `src/`), ajouter dans `<head>` :
   ```html
   <link rel="preconnect" href="https://fonts.googleapis.com">
   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
   <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
   ```
2. Dans `src/index.css`, après `@import "tailwindcss";` :
   - Bloc `@theme` pour définir `--font-sans: "Inter", sans-serif;`
   - Sélecteur `body` avec `font-family: 'Inter', sans-serif;`, `-webkit-font-smoothing: antialiased`, `-moz-osx-font-smoothing: grayscale`
   - Classe `.liquid-glass` et son `::before` (voir spec original)

### Étape 4 — Composants `FadeIn` et `AnimatedHeading`
- Créer `src/components/FadeIn.tsx` : wrapper qui part de `opacity: 0` et transition vers `opacity: 1` après un `delay` configurable (via `setTimeout` + `useState`). `duration` aussi configurable. Utiliser `transitionDuration` en style inline + `transition-opacity` de Tailwind.
- Créer `src/components/AnimatedHeading.tsx` : splitte le texte sur `\n` en lignes, puis chaque ligne en caractères. Chaque caractère est un `<span>` `inline-block` qui passe de `opacity: 0` + `translateX(-18px)` à `opacity: 1` + `translateX(0)`. Délai calculé : `(lineIndex * lineLength * charDelay) + (charIndex * charDelay)` avec `charDelay = 30ms`, début après `200ms`, transition de `500ms` par caractère. Les espaces doivent être rendus comme `\u00A0`.

### Étape 5 — Navbar
- Composant `src/components/Navbar.tsx`
- Padding horizontal : `px-6 md:px-12 lg:px-16`, padding top `pt-6`
- Barre : classe `.liquid-glass`, `rounded-xl`, `px-4 py-2`, `flex items-center justify-between`
- Gauche : logo "VEX" (`text-2xl font-semibold tracking-tight`)
- Centre (`hidden md:flex`) : liens "Story", "Investing", "Building", "Advisory" (`text-sm gap-8`, hover `gray-300`)
- Droite : bouton "Start a Chat" (`bg-white text-black px-6 py-2 rounded-lg text-sm font-medium`, hover `gray-100`)

### Étape 6 — Hero avec vidéo background
- Composant `src/components/Hero.tsx` (ou directement dans `App.tsx`)
- Vidéo en `absolute inset-0 w-full h-full object-cover`, `autoPlay loop muted playsInline`
- URL vidéo : `https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260403_050628_c4e32401-fab4-4a27-b7a8-6e9291cd5959.mp4`
- ⚠️ **Aucun overlay** sur la vidéo (pas de dégradé, pas de couche sombre, rien — elle joue brute)
- Contenu : même padding horizontal que la navbar, `flex-1 flex flex-col justify-end`, `pb-12 lg:pb-16`
- Layout large screen : `lg:grid lg:grid-cols-2 lg:items-end`
- **Colonne gauche** :
  - Titre (via `AnimatedHeading`) : `"Shaping tomorrow\nwith vision and action."` — le `\n` est un vrai retour à la ligne littéral dans la string
  - Classes titre : `text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-normal mb-4`, style inline `letterSpacing: '-0.04em'`
  - Sous-titre (dans `FadeIn delay=800 duration=1000`) : "We back visionaries and craft ventures that define what comes next." — `text-base md:text-lg text-gray-300 mb-5`
  - Row de boutons (dans `FadeIn delay=1200 duration=1000`) : `flex flex-wrap gap-4`
    - "Start a Chat" : `bg-white text-black px-8 py-3 rounded-lg font-medium`
    - "Explore Now" : `liquid-glass border border-white/20 text-white px-8 py-3 rounded-lg font-medium` + transition hover → fond blanc / texte noir
- **Colonne droite** (dans `FadeIn delay=1400 duration=1000`) :
  - Wrapper : `flex items-end justify-start lg:justify-end`
  - Carte glass : `liquid-glass border border-white/20 px-6 py-3 rounded-xl`
  - Texte : "Investing. Building. Advisory." — `text-lg md:text-xl lg:text-2xl font-light`

### Étape 7 — Test local + polish
- `npm run dev`, vérifier toutes les animations, les breakpoints (mobile, md, lg, xl)
- Vérifier que la vidéo ne se décale pas sur petit viewport
- Vérifier le rendu de la police Inter (pas de flash de police système)

---

## 📜 Spec original complet (référence)

```
Video Background :
- Full-screen background video, absolutely positioned, covering the entire viewport (object-cover)
- Video URL: https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260403_050628_c4e32401-fab4-4a27-b7a8-6e9291cd5959.mp4
- Autoplay, loop, muted, playsInline
- NO dark overlay, NO gradient overlay, NO semi-transparent layer on top of the video.

Typography :
- Import Google Font Inter via <link> in index.html
- body font-family: 'Inter', sans-serif
- -webkit-font-smoothing: antialiased
- -moz-osx-font-smoothing: grayscale
- Tailwind v4 : utiliser @theme { --font-sans: "Inter", sans-serif; } dans index.css

Navbar :
- px-6 md:px-12 lg:px-16, pt-6
- .liquid-glass, rounded-xl, px-4 py-2, flex items-center justify-between
- Gauche : "VEX" — text-2xl font-semibold tracking-tight
- Centre (hidden md:flex) : Story, Investing, Building, Advisory — text-sm gap-8, hover gray-300
- Droite : "Start a Chat" — bg-white text-black px-6 py-2 rounded-lg text-sm font-medium, hover gray-100

Hero :
- Container : même padding horizontal que navbar, flex-1 flex flex-col justify-end, pb-12 lg:pb-16
- lg:grid lg:grid-cols-2 lg:items-end

Col gauche :
- Titre : "Shaping tomorrow\nwith vision and action." (retour ligne littéral)
- text-4xl md:text-5xl lg:text-6xl xl:text-7xl, font-normal, mb-4, letterSpacing: '-0.04em'
- Animation char-by-char : chaque char part opacity 0 + translateX(-18px), arrive à opacity 1 + translateX(0)
- Délai par char : (lineIndex * lineLength * 30ms) + (charIndex * 30ms), démarre à 200ms, transition 500ms
- Espaces en \u00A0

Sous-titre :
- "We back visionaries and craft ventures that define what comes next."
- text-base md:text-lg text-gray-300 mb-5
- Fade-in : delay 800ms, duration 1000ms

Boutons :
- flex-wrap gap-4
- "Start a Chat" : bg-white text-black px-8 py-3 rounded-lg font-medium
- "Explore Now" : liquid-glass border border-white/20 text-white px-8 py-3 rounded-lg font-medium, hover → bg blanc + texte noir
- Fade-in : delay 1200ms, duration 1000ms

Col droite (tag) :
- flex items-end justify-start lg:justify-end
- liquid-glass border border-white/20 px-6 py-3 rounded-xl
- "Investing. Building. Advisory." — text-lg md:text-xl lg:text-2xl font-light
- Fade-in : delay 1400ms, duration 1000ms

Liquid Glass CSS :
.liquid-glass {
  background: rgba(0, 0, 0, 0.4);
  background-blend-mode: luminosity;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  border: none;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
}
.liquid-glass::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1.4px;
  background: linear-gradient(180deg,
    rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.1) 20%,
    rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%,
    rgba(255,255,255,0.1) 80%, rgba(255,255,255,0.3) 100%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}

Palette :
- Fond noir, texte blanc, gray-300 pour secondaire, white/20 pour bordures
- PAS de violet, PAS d'indigo
```

---

## 🛠️ Stack

- React 18 + TypeScript
- Vite (avec plugin `@tailwindcss/vite`)
- Tailwind CSS **v4** (via `@import "tailwindcss";` dans `src/index.css`)
- Pas de lib UI additionnelle. `lucide-react` dispo si besoin d'icônes (aucune utilisée pour l'instant).

---

## ▶️ Comment reprendre

Quand l'utilisateur t'envoie un message, commence par lui dire où on en est (Étape 3 à attaquer) et propose la marche à suivre détaillée pour cette étape uniquement. Ne dump pas tout d'un coup.
