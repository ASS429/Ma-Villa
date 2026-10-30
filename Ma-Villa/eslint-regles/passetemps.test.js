// Tests des règles ESLint de PasseTemps : chaque faute déjà commise est
// refusée, chaque usage légitime passe.
//
//   node eslint-regles/passetemps.test.js        (npm run test:regles)

import { RuleTester } from 'eslint'
import passetemps from './passetemps.js'

const testeur = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

testeur.run('vocabulaire', passetemps.rules.vocabulaire, {
  valid: [
    // L'interne garde « villa » : routes, composants, clés, comparaisons.
    "import VillaCard from './components/VillaCard'",
    "navigate('/dashboard/villas/nouvelle')",
    "const types = { villa_entiere: 'Villa entière' }",
    "if (cle === 'villa') faire()",
    // La catégorie elle-même, et une villa décrite comme telle.
    "const aide = 'La villa entière, un appartement, un studio, une chambre…'",
    "const exemple = 'Une villa de quatre chambres à cinq minutes de la plage'",
    "const accroche = 'Villas, résidences, appartements ou chambres.'",
    // La marque bien écrite, et l'adresse.
    "const titre = 'PasseTemps'",
    "const adresse = 'passetemps.sn'",
    'const t = <p>Bienvenue sur PasseTemps</p>',
  ],
  invalid: [
    { code: "const aide = 'ou la piscine seule à la journée'", errors: 1 },
    { code: "const detail = 'Villas, appartements, piscines à la journée'", errors: 1 },
    { code: "const e = 'Impossible de charger cette villa.'", errors: 1 },
    { code: "const b = 'Parcourir les villas'", errors: 1 },
    { code: 'const nb = (n) => `${n} villa${n > 1 ? "s" : ""}`', errors: 1 },
    { code: 'const voir = (n) => `Voir les ${n} villas`', errors: 1 },
    { code: "const l = 'Annonces vérifiées'", errors: 1 },
    { code: "const s = 'Every villa is checked by our team'", errors: 1 },
    { code: "const s = 'Featured villas'", errors: 1 },
    { code: "const a = 'Rechercher une villa'", errors: 1 },
    { code: 'const t = <h2>Mes villas</h2>', errors: 1 },
    { code: "const m = 'Bienvenue sur Passe Temps'", errors: 1 },
    { code: "const m = 'Bienvenue sur Ma Villa'", errors: 1 },
  ],
})

testeur.run('blanc-sur-couleur', passetemps.rules['blanc-sur-couleur'], {
  valid: [
    "const s = { background: 'var(--accent)', color: 'var(--on-accent)' }",
    "const s = { background: 'var(--accent-bg)', color: 'var(--accent)' }",
    // Du blanc sur une photo assombrie : ce n'est pas un fond d'accent.
    "const s = { background: 'rgba(255,255,255,0.16)', color: '#fff' }",
  ],
  invalid: [
    { code: "const s = { background: 'var(--accent)', color: '#fff' }", errors: 1 },
    { code: "const s = { backgroundColor: 'var(--danger)', color: 'white' }", errors: 1 },
  ],
})

console.log('Règles PasseTemps : tous les cas passent.')
