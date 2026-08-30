/**
 * Pré-rendu des métadonnées, après `vite build`.
 *
 * ── Le problème ──────────────────────────────────────────────────
 * L'application est une SPA : les métadonnées sont posées en JavaScript par
 * `components/Seo.tsx`. Un robot qui n'exécute pas de script ne voit donc que
 * le gabarit — et `/villas/27` servait, mot pour mot, le titre de l'accueil.
 * Toutes les fiches se ressemblaient.
 *
 * Ce n'est pas d'abord un problème Google : depuis 2019 Googlebot exécute le
 * JavaScript, avec retard et sans garantie. C'est un problème de **partage**.
 * WhatsApp, Facebook et LinkedIn ne lancent aucun script : ils lisent le HTML
 * livré, point. Sur ce marché où un lien se partage par WhatsApp, une villa
 * envoyée à un ami s'affichait sans nom, sans photo, sans prix.
 *
 * ── Pourquoi au build, et pas un rendu serveur ───────────────────
 * Le front est un site statique sur Render : aucun serveur ne tourne pour
 * intercepter une requête. Un rendu serveur imposerait de déplacer
 * l'hébergement. Le pré-rendu écrit un fichier par route, que l'hébergeur sert
 * avant d'appliquer sa règle de réécriture.
 *
 * Le coût de ce choix, assumé : une villa publiée après le build n'a ses
 * métadonnées qu'au déploiement suivant. Ce n'est **pas** un problème de
 * données — l'application charge toujours l'API au démarrage, et le visiteur
 * voit la villa. Seul l'aperçu de partage attend.
 *
 * ── Ce qui ne doit jamais arriver ────────────────────────────────
 * Que l'API endormie fasse échouer un déploiement. Railway s'endort entre deux
 * visites : si elle ne répond pas, on écrit les pages fixes, on prévient
 * bruyamment, et on laisse le plan de site précédent en place plutôt que de le
 * remplacer par un plan vide.
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(RACINE, 'dist')

const SITE = (process.env.VITE_SITE_URL || 'https://mavilla-web.onrender.com').replace(/\/$/, '')
const API = (process.env.VITE_API_URL || 'https://ma-villa-production.up.railway.app/api').replace(/\/$/, '')

/** Le prix est en FCFA, sans décimales — convention du projet. */
const fcfa = (n) => `${Math.round(Number(n)).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ')} FCFA`

const UNITE = {
  nuitee: 'nuitée', journee: 'journée', demi_journee: 'demi-journée', pass: 'pass',
}

/**
 * Les noms et descriptions viennent des propriétaires : sans échappement, un
 * guillemet dans « Villa "Les Palmiers" » fermerait l'attribut et tout ce qui
 * suit passerait en HTML.
 *
 * Deux échappements distincts, parce que les contextes le sont. Dans un
 * attribut, guillemets et apostrophes doivent partir. Dans le contenu d'un
 * élément — un `<title>` — ils sont inoffensifs, et les échapper produit un
 * titre où les moteurs qui lisent la balise sans décoder affichent
 * « Conditions générales d&#39;utilisation ».
 */
const echapperAttribut = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const echapperTexte = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Coupe sur un mot entier : une description tronquée en plein mot se voit. */
function resumer(texte, max = 155) {
  const plat = String(texte ?? '').replace(/\s+/g, ' ').trim()
  if (plat.length <= max) return plat

  const coupe = plat.slice(0, max)
  return coupe.slice(0, coupe.lastIndexOf(' ')).replace(/[,;:.]$/, '') + '…'
}

/* ── Récupération des villas ──────────────────────────────────── */

async function toutesLesVillas() {
  const villas = []

  for (let page = 1; page <= 50; page++) {
    const reponse = await fetch(`${API}/villas?page=${page}`, {
      headers: { Accept: 'application/json' },
      // Railway démarre à froid : mieux vaut attendre que renoncer trop tôt.
      signal: AbortSignal.timeout(30_000),
    })
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status} sur /villas?page=${page}`)

    const corps = await reponse.json()
    const lot = Array.isArray(corps) ? corps : (corps.data ?? [])
    villas.push(...lot)

    const derniere = Array.isArray(corps) ? 1 : (corps.last_page ?? 1)
    if (page >= derniere) break
  }

  return villas
}

/* ── Fabrique d'une page ──────────────────────────────────────── */

function pageVilla(villa) {
  const ville = villa.ville ?? ''
  const titre = `${villa.nom}${ville ? ` — ${ville}` : ''} — PasseTemps`

  const prix = villa.prix_min != null
    ? `À partir de ${fcfa(villa.prix_min)}${villa.prix_min_unite ? ` / ${UNITE[villa.prix_min_unite] ?? villa.prix_min_unite}` : ''}. `
    : ''

  const description = resumer(prix + (villa.description || `Location à ${ville}, au Sénégal.`))
  const photo = villa.photos?.[0]?.url

  // schema.org : `Product` avec une offre, parce que c'est le type que les
  // moteurs exploitent réellement pour afficher un prix et une note. La note
  // n'est jointe que s'il existe de vrais avis — inventer un `aggregateRating`
  // sur zéro avis est exactement ce que les moteurs sanctionnent.
  const note = Number(villa.note_moyenne)
  const nbAvis = Number(villa.avis_count ?? 0)

  const donnees = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: villa.nom,
    description: resumer(villa.description || titre, 300),
    ...(photo ? { image: photo } : {}),
    ...(ville ? { areaServed: { '@type': 'Place', name: ville } } : {}),
    ...(villa.prix_min != null ? {
      offers: {
        '@type': 'Offer',
        price: String(Math.round(Number(villa.prix_min))),
        priceCurrency: 'XOF',
        availability: 'https://schema.org/InStock',
        url: `${SITE}/villas/${villa.id}/`,
      },
    } : {}),
    ...(nbAvis > 0 && note > 0 ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: note.toFixed(1),
        reviewCount: nbAvis,
        bestRating: '5',
      },
    } : {}),
  }

  return { chemin: `villas/${villa.id}`, titre, description, image: photo, donnees }
}

const PAGES_FIXES = [
  {
    chemin: '',
    titre: 'PasseTemps — Location de villas au Sénégal',
    description: 'Louez une villa, une résidence, un appartement ou une chambre au Sénégal — Saly, '
      + 'Mbour, Dakar. Tarifs affichés, disponibilités en temps réel, paiement Wave ou Orange Money.',
    donnees: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'PasseTemps',
      url: SITE,
      inLanguage: 'fr',
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE}/villas?ville={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
  },
  {
    chemin: 'villas',
    titre: 'Toutes les villas — PasseTemps',
    description: 'Parcourez les villas, résidences, appartements et chambres '
      + 'disponibles au Sénégal. Filtrez par ville, dates, budget et équipements.',
  },
  // Les quatre pages légales portent une note d'attente depuis le 20 août 2026 :
  // la rédaction est confiée au juriste. Les descriptions le disent, sans quoi un
  // moteur indexerait ces pages comme des textes en vigueur.
  { chemin: 'conditions-generales', titre: "Conditions générales d'utilisation — PasseTemps",
    description: "Conditions générales de PasseTemps — en cours de rédaction par notre conseil juridique. Cette page décrit en attendant le fonctionnement réel du service." },
  { chemin: 'confidentialite', titre: 'Politique de confidentialité — PasseTemps',
    description: "Politique de confidentialité de PasseTemps — en cours de rédaction. Cette page indique quelles données nous conservons et ce que nous n'en faisons pas." },
  { chemin: 'annulation', titre: "Conditions d'annulation — PasseTemps",
    description: "Conditions d'annulation de PasseTemps — en cours de rédaction. Cette page indique comment une demande de remboursement est traitée en attendant." },
  { chemin: 'mentions-legales', titre: 'Mentions légales — PasseTemps',
    description: 'Éditeur, hébergement et prestataire de paiement de PasseTemps. Mentions en cours de complétion par notre conseil juridique.' },
]

/* ── Injection dans le gabarit ────────────────────────────────── */

/**
 * L'URL canonique porte une **barre oblique finale**, et ce n'est pas un choix
 * esthétique.
 *
 * Render applique sa règle de réécriture avant de résoudre l'index d'un
 * dossier : `/villas/10` part vers `index.html` et sert le gabarit générique,
 * alors que `/villas/10/` sert bien la page pré-rendue. Mesuré sur la
 * production, cache contourné.
 *
 * On aurait pu ajouter des règles explicites dans `render.yaml`, mais une
 * réécriture `/villas/:id` vers un fichier absent renverrait 404 : toute villa
 * publiée après le dernier build deviendrait introuvable. La barre oblique n'a
 * pas ce défaut — une villa non pré-rendue retombe simplement sur
 * l'application, vérifié aussi.
 */
const canonique = (chemin) => (chemin ? `${SITE}/${chemin}/` : `${SITE}/`)

function injecter(gabarit, { chemin, titre, description, image, donnees }) {
  const url = canonique(chemin)
  const imageAbsolue = image
    ? (image.startsWith('http') ? image : SITE + image)
    : `${SITE}/og-image.jpg`

  let html = gabarit

  // Le titre du gabarit est remplacé, pas doublé : deux <title> et les robots
  // retiennent le premier, c'est-à-dire le générique.
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${echapperTexte(titre)}</title>`)

  const remplacerMeta = (attribut, cle, valeur) => {
    const motif = new RegExp(`<meta\\s+${attribut}="${cle}"\\s+content="[^"]*"\\s*/?>`)
    const balise = `<meta ${attribut}="${cle}" content="${echapperAttribut(valeur)}" />`
    html = motif.test(html) ? html.replace(motif, balise) : html.replace('</head>', `    ${balise}\n  </head>`)
  }

  remplacerMeta('name', 'description', description)
  remplacerMeta('property', 'og:title', titre)
  remplacerMeta('property', 'og:description', description)
  remplacerMeta('property', 'og:image', imageAbsolue)
  remplacerMeta('property', 'og:url', url)
  remplacerMeta('name', 'twitter:title', titre)
  remplacerMeta('name', 'twitter:description', description)
  remplacerMeta('name', 'twitter:image', imageAbsolue)

  // Canonique : sans elle, une même fiche atteinte avec des paramètres de
  // suivi (`?source=whatsapp`) compte comme autant de pages distinctes.
  // Nommée `baliseCanonique` et non `canonique` : la seconde est la fonction
  // déclarée plus haut, et une locale du même nom la masquerait sur toute la
  // portée de `injecter` — `canonique(chemin)`, appelé dès la première ligne,
  // tomberait alors dans la zone morte temporelle. Le build a échoué là-dessus.
  const baliseCanonique = `<link rel="canonical" href="${url}" />`
  html = /rel="canonical"/.test(html)
    ? html.replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/, baliseCanonique)
    : html.replace('</head>', `    ${baliseCanonique}\n  </head>`)

  if (donnees) {
    // `</` échappé : une description contenant « </script> » interromprait le
    // bloc et injecterait du balisage dans la page.
    const json = JSON.stringify(donnees).replace(/</g, '\\u003c')
    html = html.replace('</head>', `    <script type="application/ld+json">${json}</script>\n  </head>`)
  }

  return html
}

/* ── Plan de site ─────────────────────────────────────────────── */

function planDeSite(pages) {
  const entrees = pages.map(({ chemin, priorite = '0.7', frequence = 'weekly' }) => {
    const url = canonique(chemin)
    return `  <url>\n    <loc>${url}</loc>\n    <changefreq>${frequence}</changefreq>\n`
      + `    <priority>${priorite}</priority>\n  </url>`
  })

  return `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<!-- Généré au build par scripts/prerendu.mjs — ne pas modifier à la main. -->\n`
    + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entrees.join('\n')}\n</urlset>\n`
}

const ROBOTS = `User-agent: *
Allow: /

# Espaces privés : rien à indexer, et les URL contiennent des identifiants.
Disallow: /dashboard
Disallow: /admin
Disallow: /reinitialiser-mot-de-passe
Disallow: /email-verifie

# Le tunnel de paiement n'a aucune raison d'être exploré.
Disallow: /reservation

Sitemap: ${SITE}/sitemap.xml
`

/* ── Exécution ────────────────────────────────────────────────── */

async function principal() {
  const gabarit = await readFile(join(DIST, 'index.html'), 'utf8')

  let villas = []
  let apiJoignable = true

  try {
    villas = await toutesLesVillas()
    console.log(`  ${villas.length} villa(s) publiée(s) récupérée(s)`)
  } catch (e) {
    apiJoignable = false
    // Bruyant, mais pas fatal : un déploiement ne doit pas échouer parce que
    // l'API dormait. Les pages fixes suffisent à ne pas régresser.
    console.warn(`\n  ⚠️  API injoignable (${e.message}).`)
    console.warn('      Les fiches villa ne seront pas pré-rendues, et le plan de site')
    console.warn('      précédent est conservé. Relancer le déploiement API réveillée.\n')
  }

  const pages = [
    ...PAGES_FIXES.map((p) => ({ ...p, priorite: p.chemin === '' ? '1.0' : '0.8' })),
    ...villas.map(pageVilla).map((p) => ({ ...p, priorite: '0.6', frequence: 'daily' })),
  ]

  for (const page of pages) {
    const dossier = page.chemin ? join(DIST, page.chemin) : DIST
    await mkdir(dossier, { recursive: true })
    await writeFile(join(dossier, 'index.html'), injecter(gabarit, page), 'utf8')
  }

  await writeFile(join(DIST, 'robots.txt'), ROBOTS, 'utf8')

  if (apiJoignable) {
    await writeFile(join(DIST, 'sitemap.xml'), planDeSite(pages), 'utf8')
  } else {
    // On ne remplace pas un plan complet par un plan amputé.
    try {
      await access(join(DIST, 'sitemap.xml'))
    } catch {
      await writeFile(join(DIST, 'sitemap.xml'), planDeSite(pages), 'utf8')
    }
  }

  console.log(`  ${pages.length} page(s) pré-rendue(s) · plan de site et robots.txt écrits`)
  console.log(`  site : ${SITE}`)
}

principal().catch((e) => {
  console.error('Pré-rendu échoué :', e.message)
  process.exit(1)
})
