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

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(RACINE, 'dist')

/**
 * Ce script tourne dans node, pas dans Vite : `.env.production` ne lui
 * arrive pas tout seul. Sur Render les variables sont dans l'environnement
 * du processus et tout allait bien ; en local elles manquaient, et une même
 * commande produisait deux sites différents — canoniques, plan de site et
 * image de partage compris. Un pré-rendu qu'on ne peut pas reproduire hors
 * du serveur ne se vérifie jamais avant d'être en ligne. D'où cette lecture
 * du fichier, faite une fois pour toutes.
 */
const ENV_PRODUCTION = (() => {
  try {
    return readFileSync(join(RACINE, '.env.production'), 'utf8')
  } catch {
    return '' // Pas de fichier : chaque lecture retombera sur son défaut.
  }
})()

/**
 * L'environnement du processus d'abord, le fichier ensuite, la chaîne vide
 * en dernier ressort.
 *
 * Découpage ligne à ligne, et non une expression régulière assemblée autour
 * du nom : dans un littéral gabarit, une classe comme `\\s` réclame
 * **deux** antislashs, et l'écrire avec un seul la réduit à la lettre « s »
 * sans que rien ne proteste. Le repli sur le fichier aurait cessé de
 * fonctionner en silence, et le site se serait pré-rendu sur le mauvais
 * domaine.
 */
function variable(nom) {
  if (process.env[nom]) return process.env[nom]

  for (const ligne of ENV_PRODUCTION.split(/\r?\n/)) {
    const separateur = ligne.indexOf('=')
    if (separateur === -1) continue
    // Les lignes de commentaire ne peuvent pas passer : « # VITE_x » n'est
    // pas « VITE_x », la comparaison porte sur le nom entier.
    if (ligne.slice(0, separateur).trim() !== nom) continue

    return ligne.slice(separateur + 1).trim().replace(/^["']|["']$/g, '')
  }

  return ''
}

/**
 * Le domaine qui fait autorité. Le repli en dur reste l'hôte Render : il
 * sert toujours, et il vaut mieux qu'une adresse vide.
 */
function domaine() {
  return variable('VITE_SITE_URL') || 'https://mavilla-web.onrender.com'
}

const SITE = domaine().replace(/\/$/, '')

/**
 * Jeton de propriété Google Search Console, optionnel.
 *
 * La méthode recommandée reste l'enregistrement DNS TXT : elle couvre l'apex,
 * `www` et tout futur sous-domaine d'un coup, et ne demande aucun déploiement.
 * Cette balise est le repli quand la main sur le DNS manque — elle n'est posée
 * que si le jeton existe, sinon rien n'est écrit.
 */
const VERIFICATION_GOOGLE = variable('VITE_GOOGLE_VERIFICATION')

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

/**
 * Le catalogue de la boutique, ou `null` si la boutique est fermée.
 *
 * La distinction n'est pas cosmétique. `OeuvreController` répond **404** quand
 * `boutique.actif` vaut false, et son commentaire dit pourquoi : tant que le
 * métier n'est pas ouvert, ces adresses ne doivent pas exister du tout — un
 * 503 inviterait les moteurs à garder l'URL sous le coude.
 *
 * On respecte cette décision : boutique fermée, ni `/boutique` ni aucune fiche
 * n'entrent au plan de site. Toute autre erreur reste une panne d'API, et
 * remonte pour que le plan de site précédent soit conservé.
 */
async function toutesLesOeuvres() {
  const oeuvres = []

  for (let page = 1; page <= 50; page++) {
    const reponse = await fetch(`${API}/oeuvres?page=${page}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    })

    if (reponse.status === 404) return null
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status} sur /oeuvres?page=${page}`)

    const corps = await reponse.json()
    const lot = Array.isArray(corps) ? corps : (corps.data ?? [])
    oeuvres.push(...lot)

    const derniere = Array.isArray(corps) ? 1 : (corps.last_page ?? 1)
    if (page >= derniere) break
  }

  return oeuvres
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
        url: `${SITE}/hebergements/${villa.id}/`,
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

  return { chemin: `hebergements/${villa.id}`, titre, description, image: photo, donnees }
}

/**
 * Une fiche d'œuvre. Même défaut que les villas avant le 19 août : `/boutique/12`
 * partagé sur WhatsApp s'affichait sans titre, sans photo et sans prix.
 */
function pageOeuvre(oeuvre) {
  const titre = `${oeuvre.titre}${oeuvre.artiste ? ` — ${oeuvre.artiste}` : ''} — PasseTemps`

  // Un article vendu reste visible — c'est la preuve que la galerie vend — mais
  // il ne doit pas être annoncé disponible.
  const achetable = oeuvre.statut === 'publiee' && Number(oeuvre.stock ?? 0) > 0

  const detail = [oeuvre.technique, oeuvre.dimensions, oeuvre.annee].filter(Boolean).join(', ')
  const description = resumer(
    `${fcfa(oeuvre.prix)}. ${detail ? detail + '. ' : ''}${oeuvre.description || ''}`.trim()
  )

  const photo = oeuvre.photos?.[0]?.url

  const donnees = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: oeuvre.titre,
    description: resumer(oeuvre.description || titre, 300),
    ...(photo ? { image: photo } : {}),
    ...(oeuvre.artiste ? { brand: { '@type': 'Person', name: oeuvre.artiste } } : {}),
    ...(oeuvre.categorie ? { category: oeuvre.categorie } : {}),
    offers: {
      '@type': 'Offer',
      price: String(Math.round(Number(oeuvre.prix))),
      priceCurrency: 'XOF',
      availability: achetable
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: `${SITE}/boutique/${oeuvre.id}/`,
    },
  }

  return { chemin: `boutique/${oeuvre.id}`, titre, description, image: photo, donnees }
}

const PAGES_FIXES = [
  {
    chemin: '',
    titre: 'PasseTemps — Villas, résidences et chambres au Sénégal',
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
        target: `${SITE}/hebergements?ville={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
  },
  {
    chemin: 'hebergements',
    titre: 'Tous les hébergements — PasseTemps',
    description: 'Parcourez les villas, résidences, appartements et chambres '
      + 'disponibles au Sénégal. Filtrez par ville, dates, budget et équipements.',
  },
  {
    // Retirée du plan de site quand la boutique est fermée : voir toutesLesOeuvres().
    siBoutiqueOuverte: true,
    chemin: 'boutique',
    titre: "Boutique d'art sénégalais — PasseTemps",
    description: "Œuvres d'artistes sénégalais — peintures, sculptures et pièces uniques. "
      + 'Livraison au Sénégal, paiement Wave ou Orange Money.',
  },
  // Les cinq pages légales sont en vigueur depuis le 3 septembre 2026 : elles
  // portaient jusque-là une note d'attente, et les descriptions le disaient.
  // Elles décrivent maintenant des règles opposables — à tenir à jour avec
  // `src/pages/legal/contenu.ts`, dont elles sont le résumé pour les moteurs.
  { chemin: 'conditions-generales', titre: "Conditions générales d'utilisation — PasseTemps",
    description: "Conditions générales de PasseTemps : rôle de la plateforme, réservation, paiement, commission de 10 puis 20 %, et responsabilités de chacun." },
  { chemin: 'confidentialite', titre: 'Politique de confidentialité — PasseTemps',
    description: "Quelles données PasseTemps conserve, à quoi elles servent, combien de temps elles sont gardées, qui les reçoit, et comment exercer vos droits." },
  { chemin: 'annulation', titre: "Conditions d'annulation — PasseTemps",
    description: "Ce qui vous est remboursé quand un séjour n'a pas lieu : remboursement intégral si l'annulation ne vient pas de vous, barème selon le délai sinon, sous 15 jours ouvrés." },
  { chemin: 'conditions-vente', titre: 'Conditions générales de vente — PasseTemps',
    description: "Conditions de vente de la boutique d'artisanat PasseTemps : commande, prix, zones de livraison, paiement en ligne ou à la livraison, retours et garanties." },
  { chemin: 'mentions-legales', titre: 'Mentions légales — PasseTemps',
    description: 'Éditeur, directeur de la publication, hébergement et prestataires techniques de PasseTemps.' },
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

  // Search Console : Google ne lit la balise que sur l'URL de la propriété,
  // mais la poser partout ne coûte rien et survit à une propriété déclarée sur
  // une autre page que l'accueil.
  if (VERIFICATION_GOOGLE) remplacerMeta('name', 'google-site-verification', VERIFICATION_GOOGLE)

  // Le gabarit est `dist/index.html`, que ce script réécrit aussi — c'est la
  // page d'accueil. Relancé sans `vite build` avant lui (`npm run prerendu`),
  // il relisait donc un gabarit déjà porteur du bloc de l'accueil, et chaque
  // fiche héritait du `WebSite` de la page d'accueil **en plus** du sien.
  // Constaté sur une fiche d'œuvre de test : deux blocs, le mauvais en premier.
  // On repart donc toujours d’un en-tête sans données structurées.
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/g, '')

  if (donnees) {
    // `</` échappé : une description contenant « </script> » interromprait le
    // bloc et injecterait du balisage dans la page.
    const json = JSON.stringify(donnees).replace(/</g, '\\u003c')
    html = html.replace('</head>', `    <script type="application/ld+json">${json}</script>\n  </head>`)
  }

  return html
}

/* ── Plan de site ─────────────────────────────────────────────── */

/**
 * Le plan de site déjà publié, ou `null`.
 *
 * ⚠️ Le repli « on garde le plan précédent » ne gardait rien. `vite build`
 * **vide `dist/`** avant que ce script ne tourne — vérifié le 2 septembre 2026
 * avec un témoin déposé dans le dossier, qui n'a pas survécu. Le fichier
 * cherché sur le disque n'existait donc jamais lors d'un vrai déploiement, et
 * le plan amputé partait quand même : **un seul déploiement lancé pendant que
 * Railway dormait suffisait à sortir toutes les fiches du plan de site.**
 *
 * On va donc le chercher là où il est : en ligne. Le déploiement précédent
 * sert encore pendant la construction du suivant.
 */
async function planDeSitePublie() {
  try {
    const reponse = await fetch(`${SITE}/sitemap.xml`, {
      headers: { Accept: 'application/xml' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!reponse.ok) return null

    const corps = await reponse.text()

    // Un hébergeur qui répond 200 avec la page d'accueil sur une adresse
    // inconnue est la règle, pas l’exception : on exige la balise racine.
    return corps.includes('<urlset') ? corps : null
  } catch {
    return null
  }
}

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
  let oeuvres = []
  // Optimiste à dessein : seul un 404 franc ferme la boutique. Une API
  // endormie ne doit pas retirer une page fixe — c'est exactement ce que le
  // repli promet de ne pas faire.
  let boutiqueOuverte = true
  let apiJoignable = true

  try {
    villas = await toutesLesVillas()
    console.log(`  ${villas.length} villa(s) publiée(s) récupérée(s)`)

    const catalogue = await toutesLesOeuvres()
    boutiqueOuverte = catalogue !== null
    oeuvres = catalogue ?? []

    console.log(boutiqueOuverte
      ? `  ${oeuvres.length} œuvre(s) en boutique récupérée(s)`
      : '  boutique fermée : ses adresses restent hors du plan de site')
  } catch (e) {
    apiJoignable = false
    // Bruyant, mais pas fatal : un déploiement ne doit pas échouer parce que
    // l'API dormait. Les pages fixes suffisent à ne pas régresser.
    console.warn(`\n  ⚠️  API injoignable (${e.message}).`)
    console.warn('      Les fiches ne seront pas pré-rendues, et le plan de site')
    console.warn('      précédent est conservé. Relancer le déploiement API réveillée.\n')
  }

  const pages = [
    ...PAGES_FIXES
      .filter((p) => !p.siBoutiqueOuverte || boutiqueOuverte)
      .map((p) => ({ ...p, priorite: p.chemin === '' ? '1.0' : '0.8' })),
    ...villas.map(pageVilla).map((p) => ({ ...p, priorite: '0.6', frequence: 'daily' })),
    ...oeuvres.map(pageOeuvre).map((p) => ({ ...p, priorite: '0.6', frequence: 'weekly' })),
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
    // On ne remplace pas un plan complet par un plan amputé : celui qui sert
    // déjà en ligne vaut mieux qu’un plan réduit aux pages fixes.
    const publie = await planDeSitePublie()

    await writeFile(join(DIST, 'sitemap.xml'), publie ?? planDeSite(pages), 'utf8')
    console.warn(publie
      ? '      Plan de site : celui déjà en ligne est conservé.'
      : '      Plan de site : aucun plan en ligne à reprendre, écriture du plan réduit.')
  }

  console.log(`  ${pages.length} page(s) pré-rendue(s) · plan de site et robots.txt écrits`)
  console.log(`  site : ${SITE}`)
}

principal().catch((e) => {
  console.error('Pré-rendu échoué :', e.message)
  process.exit(1)
})
