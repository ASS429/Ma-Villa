/**
 * Le site construit est-il en retard sur ce qui est publié ?
 *
 * ── Le problème ──────────────────────────────────────────────────
 * Le pré-rendu est figé à la compilation (voir `prerendu.mjs`). Une annonce
 * publiée après le dernier déploiement est visible pour un visiteur, mais elle
 * n'a ni page à elle, ni entrée au plan de site, et son lien partagé s'affiche
 * sans photo ni prix. Pire : elle sert le gabarit de l'accueil, **canonique
 * comprise** — elle dit donc aux moteurs de ne pas l'indexer.
 *
 * Constaté le 5 septembre 2026 : trois publications, une seule au plan de site.
 *
 * ── Pourquoi ne pas simplement reconstruire chaque nuit ──────────
 * Parce que Railway s'endort. Une reconstruction lancée API endormie écrit les
 * pages fixes **sans les fiches**, tout en conservant le plan de site précédent
 * qui, lui, les annonce encore. On détruirait de bonnes pages en silence.
 *
 * Ce script réveille donc l'API d'abord, et **échoue bruyamment** s'il n'y
 * arrive pas, plutôt que de laisser partir un déploiement destructeur.
 *
 * ── Ce qu'il décide ──────────────────────────────────────────────
 * Il compare les fiches publiées à celles déjà présentes dans le plan de site
 * en ligne, et n'annonce un redéploiement que si elles diffèrent. Les pages
 * fixes ne sont pas comparées : elles ne changent qu'avec le code, et une
 * modification du code déclenche déjà son propre déploiement.
 */

import { readFileSync, appendFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Même lecture que `prerendu.mjs` : environnement, puis fichier, puis défaut. */
function variable(nom, defaut) {
  if (process.env[nom]) return process.env[nom]

  try {
    for (const ligne of readFileSync(join(RACINE, '.env.production'), 'utf8').split(/\r?\n/)) {
      const separateur = ligne.indexOf('=')
      if (separateur === -1) continue
      if (ligne.slice(0, separateur).trim() !== nom) continue

      return ligne.slice(separateur + 1).trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    // Pas de fichier : le défaut suffit.
  }

  return defaut
}

const sansBarreFinale = (s) => (s.endsWith('/') ? s.slice(0, -1) : s)

const SITE = sansBarreFinale(variable('VITE_SITE_URL', 'https://passetemps.sn'))
const API = sansBarreFinale(variable('VITE_API_URL', 'https://ma-villa-production.up.railway.app/api'))

/* ── Réveil de l'API ──────────────────────────────────────────── */

/**
 * Railway démarre à froid : la première requête peut dépasser la minute et
 * échouer, pendant que la suivante répond. On insiste, sans se presser.
 */
async function reveiller() {
  const attentes = [0, 15, 30, 45, 60]

  for (const attente of attentes) {
    if (attente) await new Promise((r) => setTimeout(r, attente * 1000))

    try {
      const reponse = await fetch(`${API}/villas?page=1`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(60_000),
      })
      if (reponse.ok) return true

      console.log(`  réveil : HTTP ${reponse.status}, on réessaie`)
    } catch (e) {
      console.log(`  réveil : ${e.message}, on réessaie`)
    }
  }

  return false
}

/* ── Ce qui est publié ────────────────────────────────────────── */

async function collection(chemin) {
  const elements = []

  for (let page = 1; page <= 50; page++) {
    const reponse = await fetch(`${API}/${chemin}?page=${page}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(60_000),
    })

    // 404 sur la boutique = métier fermé, pas panne. Voir prerendu.mjs.
    if (reponse.status === 404) return null
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status} sur /${chemin}?page=${page}`)

    const corps = await reponse.json()
    const lot = Array.isArray(corps) ? corps : (corps.data ?? [])
    elements.push(...lot)

    const derniere = Array.isArray(corps) ? 1 : (corps.last_page ?? 1)
    if (page >= derniere) break
  }

  return elements
}

async function fichesPubliees() {
  const villas = await collection('villas')
  const oeuvres = await collection('oeuvres')

  return new Set([
    ...villas.map((v) => `${SITE}/hebergements/${v.id}/`),
    ...(oeuvres ?? []).map((o) => `${SITE}/boutique/${o.id}/`),
  ])
}

/* ── Ce que le site sert déjà ─────────────────────────────────── */

async function fichesDuPlanDeSite() {
  const reponse = await fetch(`${SITE}/sitemap.xml`, {
    headers: { Accept: 'application/xml' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!reponse.ok) throw new Error(`plan de site : HTTP ${reponse.status}`)

  const xml = await reponse.text()

  // Découpage plutôt qu'expression régulière : le fichier est produit par nous,
  // sa forme est connue, et il n'y a rien à deviner.
  const urls = xml.split('<loc>').slice(1).map((bloc) => bloc.split('</loc>')[0].trim())

  return new Set(urls.filter(estUneFiche))
}

/**
 * Une fiche, pas une liste. Compter les segments et non chercher un fragment :
 * `/hebergements/` contient `/hebergements/`, et la page de liste passait pour
 * une fiche disparue à chaque exécution.
 */
function estUneFiche(url) {
  const segments = url.replace(SITE, '').split('/').filter(Boolean)

  return segments.length === 2 && (segments[0] === 'hebergements' || segments[0] === 'boutique')
}

/* ── Exécution ────────────────────────────────────────────────── */

function annoncer(decision, raison) {
  console.log(`\n  ${raison}`)

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `redeployer=${decision}\n`)
  }
}

async function principal() {
  console.log(`  site : ${SITE}`)
  console.log(`  api  : ${API}`)

  if (!(await reveiller())) {
    // Bruyant exprès : déployer maintenant retirerait les fiches déjà en ligne.
    console.error('\n  API injoignable après cinq tentatives. Aucun déploiement lancé :')
    console.error("  reconstruire sans l'API retirerait les fiches déjà servies.")
    process.exit(1)
  }

  const publiees = await fichesPubliees()
  const enLigne = await fichesDuPlanDeSite()

  const manquantes = [...publiees].filter((u) => !enLigne.has(u))
  const disparues = [...enLigne].filter((u) => !publiees.has(u))

  console.log(`  publié : ${publiees.size} fiche(s) · plan de site : ${enLigne.size} fiche(s)`)

  for (const u of manquantes) console.log(`    + absente du plan de site : ${u}`)
  for (const u of disparues) console.log(`    - retirée depuis : ${u}`)

  if (manquantes.length === 0 && disparues.length === 0) {
    return annoncer('non', 'Le site est à jour. Rien à reconstruire.')
  }

  annoncer(
    'oui',
    `À reconstruire : ${manquantes.length} fiche(s) à ajouter, ${disparues.length} à retirer.`
  )
}

principal().catch((e) => {
  console.error('Vérification échouée :', e.message)
  process.exit(1)
})
