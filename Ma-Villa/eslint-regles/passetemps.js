// Règles ESLint propres à PasseTemps : les décisions de design produit qu'une
// machine sait vérifier. Celles qui demandent un jugement vivent dans le skill
// `.claude/skills/design-produit/`, à la racine du dépôt.
//
// Chaque règle dit pourquoi elle existe : une règle sans raison finit
// désactivée. Une exception légitime se signale sur sa ligne, avec sa raison :
//   // eslint-disable-next-line passetemps/vocabulaire -- <pourquoi>

/**
 * Le vocabulaire de l'interface : ce que l'on n'écrit plus à l'écran.
 *
 * Contrôle les chaînes, les gabarits et le texte JSX — jamais les noms de
 * variables, de routes ou de composants (`/villas`, `VillaCard` restent : on
 * ne renomme pas l'interne par zèle).
 */
const VOCABULAIRE = [
  {
    motif: /piscines?\s+(seules?|à la journée)/i,
    pourquoi:
      "La piscine seule n'est plus au catalogue depuis le 28 août 2026 : la proposer, c'est promettre une offre qui n'existe pas.",
  },
  {
    motif: /\b(cette|aucune|chaque|une autre|votre|ma|ma première|la|rechercher une) villa\b(?! entière)/i,
    pourquoi:
      "« Villa » ne désigne que la catégorie. Pour une annonce quelconque, écrire « hébergement » ou « annonce » : le catalogue compte sept types.",
  },
  {
    motif: /\b(mes|vos|les|des|aucune|parcourir les) villas\b/i,
    pourquoi:
      "« Villas » ne désigne que la catégorie. Pour le catalogue, écrire « hébergements » ou « annonces ».",
  },
  {
    motif: /\bvillas? (publiées?|enregistrées?|trouvées?|en vedette|correspond(ent)?)\b/i,
    pourquoi: "Un compte d'annonces se dit en « annonces » ou en « hébergements », pas en « villas ».",
  },
  {
    motif: /\{\} villas?\b/i,
    pourquoi:
      "Un nombre suivi de « villa(s) » compte des annonces de tout type : écrire « hébergement(s) » ou « annonce(s) ».",
  },
  {
    motif: /\bannonces? vérifiées?\b/i,
    pourquoi:
      "Une annonce est relue par l'équipe avant publication ; personne ne visite le logement. Écrire « relue », pas « vérifiée ».",
  },
  // Les pages client existent aussi en anglais (src/i18n) : mêmes décisions.
  {
    motif: /\b(every|this|that|no|your|my first) villa\b/i,
    pourquoi: "In English too, “villa” is only the category: say “listing” or “place” for any listing.",
  },
  {
    motif: /\b(featured|browse|browse the|discover the|your|my|all|no) villas\b/i,
    pourquoi: "In English too, “villas” is only the category: say “listings”, “places” or “stays”.",
  },
  {
    motif: /\bverified listings?\b|\bchecked by our team\b/i,
    pourquoi: 'A listing is reviewed by the team, nobody visits the place: say “reviewed”, not “verified”.',
  },
  {
    motif: /\b(Passe[ -]?temps|Passe-Temps|Passe Temps|PASSETEMPS)\b/,
    pourquoi: "La marque s'écrit PasseTemps : un mot, deux majuscules.",
  },
  {
    motif: /\bMa Villa\b/,
    pourquoi: "Le produit s'appelle PasseTemps depuis le 28 août 2026.",
  },
]

const texteDe = (node) => {
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value
  if (node.type === 'JSXText') return node.value
  // Un gabarit : ses morceaux, chaque expression remplacée par « {} ».
  if (node.type === 'TemplateLiteral') return node.quasis.map((q) => q.value.cooked ?? '').join('{}')
  return null
}

// Une chaîne qui n'est jamais affichée : chemin d'import, clé, comparaison.
const horsEcran = (node) => {
  const parent = node.parent
  if (!parent) return false
  if (parent.type === 'ImportDeclaration' || parent.type === 'ExportNamedDeclaration') return true
  if (parent.type === 'Property' && parent.key === node) return true
  if (parent.type === 'BinaryExpression' && ['===', '!==', '==', '!='].includes(parent.operator)) return true
  return false
}

const vocabulaire = {
  meta: {
    type: 'problem',
    docs: { description: "Refuse à l'écran les mots que PasseTemps n'emploie plus, et dit pourquoi." },
    schema: [],
    messages: { mot: '« {{extrait}} » : {{pourquoi}}' },
  },
  create(context) {
    const verifier = (node) => {
      if (horsEcran(node)) return
      const texte = texteDe(node)
      if (!texte) return
      for (const { motif, pourquoi } of VOCABULAIRE) {
        const m = motif.exec(texte)
        if (m) {
          context.report({ node, messageId: 'mot', data: { extrait: m[0], pourquoi } })
          return
        }
      }
    }
    return { Literal: verifier, JSXText: verifier, TemplateLiteral: verifier }
  },
}

/**
 * Du blanc écrit en dur sur un fond d'accent ou de danger.
 *
 * Vrai en thème clair, faux en sombre : l'accent y devient un saumon clair,
 * le rouge un rouge pâle, et du blanc dessus tombe vers 2,4 et 2,8 pour 1
 * (illisible — sur le bouton d'une suppression, celui qu'il faut lire avant de
 * cliquer). Chaque fond a son encre : `--on-accent`, `--on-danger`.
 */
const FOND = /var\(--(accent|accent-hover|danger)\)/
const BLANC = /^(#fff|#ffffff|white|rgb\(255,\s*255,\s*255\))$/i

const valeurTexte = (v) => {
  if (!v) return null
  if (v.type === 'Literal' && typeof v.value === 'string') return v.value
  if (v.type === 'TemplateLiteral' && v.expressions.length === 0) return v.quasis[0].value.cooked
  return null
}

const blancSurCouleur = {
  meta: {
    type: 'problem',
    docs: { description: "Exige l'encre du fond (--on-accent, --on-danger) au lieu du blanc en dur." },
    schema: [],
    messages: {
      blanc:
        "Blanc en dur sur var(--{{fond}}) : illisible en thème sombre. Écrire color: 'var(--on-{{encre}})'.",
    },
  },
  create(context) {
    return {
      ObjectExpression(node) {
        const proprietes = new Map()
        for (const p of node.properties) {
          if (p.type !== 'Property' || p.computed) continue
          const nom = p.key.type === 'Identifier' ? p.key.name : p.key.value
          proprietes.set(nom, p)
        }
        const fond = valeurTexte((proprietes.get('background') ?? proprietes.get('backgroundColor'))?.value)
        const couleur = proprietes.get('color')
        const m = fond && FOND.exec(fond)
        if (!m || !couleur || !BLANC.test(valeurTexte(couleur.value) ?? '')) return
        context.report({
          node: couleur,
          messageId: 'blanc',
          data: { fond: m[1], encre: m[1] === 'danger' ? 'danger' : 'accent' },
        })
      },
    }
  },
}

export default {
  meta: { name: 'passetemps' },
  rules: { vocabulaire, 'blanc-sur-couleur': blancSurCouleur },
}
