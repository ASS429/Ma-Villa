import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import passetemps from './eslint-regles/passetemps.js'

// Les bibliothèques que le site s'interdit. Sur ce marché, la data est payée
// au volume : une scène WebGL coûte 300 à 600 Ko avant la première image, et
// Chart.js ~70 Ko gzip pour trois courbes. La profondeur est en CSS composé
// (`src/styles/profondeur.css`), les graphiques en SVG à la main
// (`components/console/Graphe.tsx`).
const IMPORTS_INTERDITS = [
  ['three', 'WebGL : 300 à 600 Ko avant la première image. La profondeur se fait en CSS (profondeur.css).'],
  ['@react-three/fiber', 'WebGL : voir three.'],
  ['@react-three/drei', 'WebGL : voir three.'],
  ['ogl', 'WebGL : voir three.'],
  ['pixi.js', 'WebGL : voir three.'],
  ['@babylonjs/core', 'WebGL : voir three.'],
  ['chart.js', '~70 Ko gzip : les graphiques se dessinent en SVG (components/console/Graphe.tsx).'],
  ['react-chartjs-2', 'Voir chart.js.'],
  ['recharts', 'Voir chart.js.'],
]

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // Décisions de design produit vérifiables par machine (voir
    // eslint-regles/passetemps.js et le skill design-produit).
    files: ['src/**/*.{ts,tsx}'],
    plugins: { passetemps },
    rules: {
      'passetemps/vocabulaire': 'error',
      'passetemps/blanc-sur-couleur': 'error',
      'no-restricted-imports': [
        'error',
        { paths: IMPORTS_INTERDITS.map(([name, message]) => ({ name, message })) },
      ],
      'no-restricted-syntax': [
        'error',
        {
          // Une date (`new Date(…).toLocaleString()`) reste permise.
          selector: "CallExpression[callee.property.name='toLocaleString']:not([callee.object.type='NewExpression'])",
          message: 'Les montants passent par fcfa() de src/lib/format.ts : FCFA sans décimales, partout pareil.',
        },
      ],
    },
  },
  {
    // Le seul endroit où l'on formate un nombre à la main.
    files: ['src/lib/format.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
])
