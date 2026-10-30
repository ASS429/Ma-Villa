# Interface

Couleurs, typographie, mise en page, mouvement, poids. La source canonique des
valeurs est `Ma-Villa/src/index.css` (jetons) ; ce fichier dit **comment s'en
servir** et pourquoi.

## Couleurs

- **Jetons seulement** (`var(--accent)`, `var(--text-1)`…), jamais une couleur
  en dur dans `src/pages` ni dans les composants. Le thème sombre suit partout.
- **L'accent signale la conversion du parcours en cours** (« Rechercher »,
  « Réserver »). « Publier mon hébergement » reste secondaire partout, sauf dans
  la section qui lui est consacrée : sur une page client, la couleur d'action
  ne pointe pas vers une action qui ne le concerne pas.
- **Chaque fond de couleur a son encre** : `--on-accent`, `--on-danger`.
  Du blanc en dur sur l'accent est vrai en clair et faux en sombre (l'accent y
  devient un saumon clair : 2,4 pour 1). *Vérifié par ESLint
  (`passetemps/blanc-sur-couleur`).*
- `--gold` est un bronze olive, en fond plein du badge « Vedette » (blanc
  dessus). Les étoiles gardent `--gold-soft`, décoratives.
- Un contraste se **mesure au navigateur**, dans les deux thèmes.

## Typographie

- DM Sans pour l'interface, Cormorant Garamond pour les titres.
- ⚠ **Cormorant dessine des chiffres elzéviriens** : « 17 » se lit « I7 ».
  Toute valeur chiffrée en fonte de titre exige
  `font-variant-numeric: lining-nums tabular-nums`.
- Montants : **FCFA sans décimales**, toujours par `fcfa()` de
  `src/lib/format.ts`. *Vérifié par ESLint (pas de `toLocaleString` direct).*

## Mise en page

- **Mobile d'abord** : 375 px est la largeur de référence ; cibles tactiles de
  44 px au moins ; rien d'important sous la barre de navigation basse.
- **Carte d'annonce en 4/3**, prix isolé sous un filet, chiffres tabulaires
  (en 3/4, on ne voyait qu'une carte par écran : on ne comparait rien).
- **Une image en héros, jamais de vidéo** (data payée au volume), 1 600 px,
  moins de 180 Ko.
- Bloc tarifaire : la grille pour comparer, le parcours guidé pour choisir ;
  cliquer une case renseigne le parcours. Une formule impossible est
  **barrée, pas masquée**.
- Console (administration **et** espace personnel) : un seul châssis,
  `src/styles/console.css`. Listes par `ListeConsole` (titre, erreur avec
  reprise, squelette, vide avec issue).

## CSS

- ⚠ **Une `position` hors de `@layer` bat les utilitaires de Tailwind** sur le
  même élément, en silence. *Vérifié par `npm run verifier:css`.*
- ⚠ **Deux feuilles qui définissent la même classe** : la dernière chargée
  gagne, en silence. Deux régressions sont parties en production ainsi
  (`.tunnel-total`, `.commande-entete`). *Vérifié par
  `python scripts/audit-collisions-css.py`.* Préfixer par domaine (`achat-`
  pour la boutique, `tunnel-` pour le paiement des réservations).
- Tailwind v4 : pas de `tailwind.config.js`, tout passe par `@theme`.

## Mouvement et profondeur

- **Pas de WebGL** : 300 à 600 Ko avant la première image. La profondeur est
  en CSS composé (`src/styles/profondeur.css`, `transform` et `opacity`
  seulement). *Vérifié par ESLint (imports interdits).*
- **Aucun effet ne porte d'information** : tout retirer doit laisser un
  produit complet.
- **Trois couches composées simultanées au plus** par écran.
- Graphiques en **SVG à la main** (`components/console/Graphe.tsx`), barres
  plutôt que camembert. *Chart.js interdit par ESLint.*
- Le seul moment célébré : la réservation confirmée.

## Pages et adresses

- **Barre oblique finale** sur les adresses de fiche (`/hebergements/12/`) :
  sans elle, Render sert le gabarit générique au lieu de la page pré-rendue.
- Le français est à la racine, l'anglais sous `/en/` : une langue = une
  adresse.
