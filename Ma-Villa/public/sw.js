/* ════════════════════════════════════════════════════════════════
   Service worker — PasseTemps

   Écrit à la main plutôt que généré : ce fichier décide de ce qui est
   conservé sur l'appareil du visiteur, et cette décision-là ne se délègue
   pas à une configuration par défaut.

   Deux règles non négociables :

   1. Aucune réponse authentifiée n'entre en cache. Un cache est partagé
      par tous les profils du navigateur et survit à la déconnexion : y
      écrire une réservation ou un profil, c'est laisser des données
      personnelles derrière soi.
   2. Rien du tunnel de paiement n'est servi depuis le cache. Un montant
      ou un statut périmé y serait pire qu'une erreur réseau.
   ════════════════════════════════════════════════════════════════ */

const VERSION = 'v1'
const CACHE_COQUILLE = `passetemps-coquille-${VERSION}`
const CACHE_ASSETS = `passetemps-assets-${VERSION}`
const CACHE_IMAGES = `passetemps-images-${VERSION}`
const CACHE_API = `passetemps-api-${VERSION}`

const NOTRES = [CACHE_COQUILLE, CACHE_ASSETS, CACHE_IMAGES, CACHE_API]

/* La coquille minimale : de quoi afficher quelque chose d'utile sans réseau.
   Les scripts et styles portent une empreinte dans leur nom et sont donc mis
   en cache à l'usage, pas listés ici — une liste écrite en dur serait fausse
   dès la première publication. */
const COQUILLE = [
  '/',
  '/index.html',
  '/hors-ligne.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/logo.webp',
  // Image d'en-tête de l'accueil : sans elle, la page hors ligne s'ouvre sur
  // un rectangle vide là où se trouve le sujet du produit. Elle est de toute
  // façon téléchargée à la première visite.
  '/hero-poster.webp',
]

/* Seules ces routes d'API sont conservées : elles sont publiques, ne dépendent
   d'aucun compte, et les revoir périmées ne coûte rien. Tout le reste passe au
   réseau, sans copie locale. */
const API_PUBLIQUE = [/\/api\/villas(\?|$)/, /\/api\/destinations/, /\/api\/configuration/]

/* Jamais de cache, jamais de repli : un statut de paiement périmé ferait croire
   à un encaissement qui n'a pas eu lieu. */
const API_INTERDITE = [
  /\/api\/paiements/,
  /\/api\/reservations\/[^/]+\/paiement/,
  /\/api\/auth/,
  /\/api\/admin/,
]

const MAX_IMAGES = 60

/* ── Installation ─────────────────────────────────────────────── */

self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches
      .open(CACHE_COQUILLE)
      // addAll échoue en bloc si une seule entrée manque : on tolère les
      // absences pour qu'un fichier renommé n'empêche pas l'installation.
      .then((cache) => Promise.allSettled(COQUILLE.map((u) => cache.add(u))))
      .then(() => self.skipWaiting())
  )
})

/* ── Activation : on jette les caches des versions précédentes ── */

self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches
      .keys()
      .then((cles) =>
        Promise.all(
          cles
            // Les deux préfixes : le changement de nom laisserait sinon les
            // anciens caches sur les appareils déjà installés, à occuper de
            // la place pour des fichiers que plus rien ne sert.
            .filter((c) => (c.startsWith('passetemps-') || c.startsWith('mavilla-')) && !NOTRES.includes(c))
            .map((c) => caches.delete(c))
        )
      )
      .then(() => self.clients.claim())
  )
})

/* ── Stratégies ───────────────────────────────────────────────── */

async function reseauDabord(requete, nomCache) {
  const cache = await caches.open(nomCache)
  try {
    const reponse = await fetch(requete)
    if (reponse && reponse.ok) cache.put(requete, reponse.clone())
    return reponse
  } catch (err) {
    const enCache = await cache.match(requete)
    if (enCache) return enCache
    throw err
  }
}

async function cacheDabord(requete, nomCache) {
  const cache = await caches.open(nomCache)
  const enCache = (await cache.match(requete)) || (await caches.match(requete))
  if (enCache) return enCache

  const reponse = await fetch(requete)
  if (reponse && reponse.ok) cache.put(requete, reponse.clone())
  return reponse
}

/** Sert la copie locale tout de suite et rafraîchit en arrière-plan. */
async function cacheEtRafraichit(requete, nomCache, plafond) {
  const cache = await caches.open(nomCache)

  // Le repli sur `caches.match` cherche dans *tous* les caches, coquille
  // comprise. Sans lui, un fichier préchargé à l'installation reste invisible
  // au gestionnaire qui ne consulte que son propre cache : le logo était en
  // coquille et échouait quand même hors ligne.
  const enCache = (await cache.match(requete)) || (await caches.match(requete))

  const reseau = fetch(requete)
    .then((reponse) => {
      if (reponse && reponse.ok) {
        cache.put(requete, reponse.clone()).then(() => plafond && limiter(nomCache, plafond))
      }
      return reponse
    })
    .catch(() => null)

  return enCache || (await reseau) || Response.error()
}

/** Un cache d'images sans plafond finit par occuper tout le quota. */
async function limiter(nomCache, plafond) {
  const cache = await caches.open(nomCache)
  const cles = await cache.keys()
  for (let i = 0; i < cles.length - plafond; i++) await cache.delete(cles[i])
}

/* ── Interception ─────────────────────────────────────────────── */

self.addEventListener('fetch', (evt) => {
  const { request } = evt
  const url = new URL(request.url)

  // Une écriture ne se rejoue pas depuis un cache.
  if (request.method !== 'GET') return

  // `cache: 'no-store'` est une demande explicite de fraîcheur : c'est ainsi
  // que le bandeau « nouvelle version » compare le script publié au script
  // chargé. L'intercepter le rendrait aveugle.
  if (request.cache === 'no-store' || request.headers.has('Range')) return

  // Une réponse authentifiée n'appartient qu'à une session : elle ne doit
  // laisser aucune trace sur l'appareil.
  if (request.headers.has('Authorization')) return

  const chemin = url.pathname + url.search

  if (chemin.includes('/api/')) {
    if (API_INTERDITE.some((r) => r.test(chemin))) return
    if (API_PUBLIQUE.some((r) => r.test(chemin))) {
      evt.respondWith(reseauDabord(request, CACHE_API))
    }
    return
  }

  // Navigation : le réseau d'abord pour ne jamais servir un écran périmé, la
  // coquille ensuite, et faute de tout une page qui explique.
  if (request.mode === 'navigate') {
    evt.respondWith(
      fetch(request).catch(
        async () =>
          (await caches.match('/index.html')) ||
          (await caches.match('/hors-ligne.html')) ||
          Response.error()
      )
    )
    return
  }

  if (url.origin !== self.location.origin) {
    // Les fontes Google sont immuables et servies sous un nom stable.
    if (/fonts\.(googleapis|gstatic)\.com/.test(url.hostname)) {
      evt.respondWith(cacheEtRafraichit(request, CACHE_ASSETS))
    }
    return
  }

  // Les fichiers d'/assets/ portent une empreinte de leur contenu : un nom
  // donné désigne toujours les mêmes octets. Le cache d'abord est sûr.
  if (url.pathname.startsWith('/assets/')) {
    evt.respondWith(cacheDabord(request, CACHE_ASSETS))
    return
  }

  if (/\.(png|jpe?g|webp|avif|gif|svg|ico)$/i.test(url.pathname)) {
    evt.respondWith(cacheEtRafraichit(request, CACHE_IMAGES, MAX_IMAGES))
    return
  }

  if (/\.(js|css|woff2?)$/i.test(url.pathname)) {
    evt.respondWith(cacheEtRafraichit(request, CACHE_ASSETS))
  }
})

/* ── Notifications poussées ───────────────────────────────────── */

self.addEventListener('push', (evt) => {
  let charge = {}
  try {
    charge = evt.data ? evt.data.json() : {}
  } catch {
    charge = { corps: evt.data ? evt.data.text() : '' }
  }

  const titre = charge.titre || 'PasseTemps'
  const options = {
    body: charge.corps || '',
    icon: charge.icone || '/icon-192.png',
    badge: '/icon-192.png',
    lang: 'fr',
    // Deux notifications de même sujet se remplacent au lieu de s'empiler :
    // trois relances pour la même réservation, c'est une désinstallation.
    tag: charge.groupe || 'ma-villa',
    renotify: Boolean(charge.groupe),
    requireInteraction: false,
    data: { url: charge.url || '/', ...(charge.donnees || {}) },
    actions: Array.isArray(charge.actions) ? charge.actions.slice(0, 2) : [],
  }

  evt.waitUntil(self.registration.showNotification(titre, options))
})

self.addEventListener('notificationclick', (evt) => {
  evt.notification.close()

  const cible = evt.action || evt.notification.data?.url || '/'
  const url = new URL(cible, self.location.origin).href

  // Rouvrir un onglet alors que l'application est déjà ouverte donne deux
  // copies de l'écran : on va chercher celle qui existe avant d'en créer une.
  evt.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      for (const f of fenetres) {
        if (f.url === url && 'focus' in f) return f.focus()
      }
      for (const f of fenetres) {
        if ('navigate' in f && 'focus' in f) return f.navigate(url).then((c) => c && c.focus())
      }
      return self.clients.openWindow(url)
    })
  )
})

/* ── Contrôle depuis la page ──────────────────────────────────── */

self.addEventListener('message', (evt) => {
  if (evt.data === 'SKIP_WAITING') self.skipWaiting()
})
