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

## Design : refonte en cours

La direction artistique est en cours de refonte via Claude Design, avec le brief
`../docs/03-PROMPT-CLAUDE-DESIGN.md`. Le relevé de l'existant est dans
`../docs/02-DESIGN-SYSTEM-EXTRAIT.md`.

**En attendant : ne pas engager de restylage de fond.** Rester dans le langage visuel
actuel (sable / terracotta / or, Cormorant Garamond en display + DM Sans en interface).

Ce qui est connu et sera traité par la refonte, inutile de le corriger à la main :
absence de composants primitifs (`Button`, `Input`, `Card`…), styles inline nombreux,
doublon `Navbar` / `PageHeader`.

---

## Avant de déclarer une tâche terminée

```bash
npx tsc -b          # doit passer
npx eslint src      # doit être à zéro — c'est l'état actuel, ne pas le dégrader
npm run build
cd ../backend && php artisan test    # 95 tests
```

---

## État et suite

`../docs/01-AUDIT-WEB.md` contient l'audit complet et le plan en trois jalons.
Le Jalon 1 est fait. **Restent bloquants pour le lancement :**

1. **Paiement Wave / Orange Money** — table et modèle `Paiement` présents, aucun contrôleur,
   aucune route, aucune interface.
2. **Compléter les mentions `[À COMPLÉTER]`** de `src/pages/legal/contenu.ts` et faire relire
   les textes par un juriste.
3. **Pré-rendu des fiches villa** — SPA sans SSR : Google ne voit pratiquement rien.
4. Carte interactive sur la recherche, statistiques propriétaire, messagerie.
