/**
 * Installation, mise à jour et notifications poussées.
 *
 * Tout ici est facultatif par construction : un navigateur sans service worker,
 * un iPhone en Safari onglet, un utilisateur qui refuse les notifications —
 * aucun de ces cas ne doit dégrader la consultation ni la réservation. Chaque
 * fonction renvoie donc un état, jamais une exception.
 */

import api from '../services/api'

/* ── Événement d'installation ─────────────────────────────────── */

/** Non typé par le DOM standard : Chrome et Edge l'émettent, pas Safari. */
export interface EvenementInstallation extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let invitationRetenue: EvenementInstallation | null = null
const abonnes = new Set<(dispo: boolean) => void>()

function diffuser(dispo: boolean) {
  abonnes.forEach((f) => f(dispo))
}

/**
 * Le navigateur n'émet `beforeinstallprompt` qu'une fois, très tôt — souvent
 * avant que React n'ait monté quoi que ce soit. L'écouteur est donc posé à
 * l'import du module et l'événement conservé : sans cela, l'invitation est
 * perdue et le bouton « Installer » ne peut plus rien déclencher.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    invitationRetenue = e as EvenementInstallation
    diffuser(true)
  })

  window.addEventListener('appinstalled', () => {
    invitationRetenue = null
    diffuser(false)
  })
}

export function installationPossible(): boolean {
  return invitationRetenue !== null
}

export function surChangementInstallation(f: (dispo: boolean) => void): () => void {
  abonnes.add(f)
  return () => abonnes.delete(f)
}

/** Déclenche l'invitation native. Renvoie `true` si l'utilisateur a accepté. */
export async function demanderInstallation(): Promise<boolean> {
  if (!invitationRetenue) return false

  try {
    await invitationRetenue.prompt()
    const { outcome } = await invitationRetenue.userChoice

    // L'invitation n'est utilisable qu'une fois : la garder après coup
    // laisserait un bouton qui ne fait plus rien.
    invitationRetenue = null
    diffuser(false)

    return outcome === 'accepted'
  } catch {
    return false
  }
}

/** Vrai quand la page tourne dans une fenêtre d'application installée. */
export function estInstallee(): boolean {
  if (typeof window === 'undefined') return false

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    // Safari iOS n'implémente pas `display-mode` et pose ce drapeau à la place.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

/**
 * iOS n'expose aucune invitation programmable : l'installation y passe par
 * « Partager » puis « Sur l'écran d'accueil ». Il faut donc l'expliquer, et
 * seulement là — le dire ailleurs serait un conseil inapplicable.
 */
export function estIOS(): boolean {
  if (typeof navigator === 'undefined') return false

  const ua = navigator.userAgent
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS se présente comme un Mac depuis 2019 ; l'écran tactile le trahit.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/* ── Enregistrement du service worker ─────────────────────────── */

export async function enregistrerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null

  // En développement le service worker sert des fichiers figés et masque les
  // modifications en cours : on ne l'active qu'une fois construit.
  if (import.meta.env.DEV) return null

  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch {
    // Un enregistrement refusé (HTTP simple, réglage du navigateur) laisse
    // l'application parfaitement fonctionnelle, en ligne seulement.
    return null
  }
}

/* ── Notifications poussées ───────────────────────────────────── */

export type EtatNotifications = 'non-supporte' | 'refuse' | 'a-demander' | 'actif'

export function etatNotifications(): EtatNotifications {
  if (typeof window === 'undefined') return 'non-supporte'
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'non-supporte'
  }

  if (Notification.permission === 'denied') return 'refuse'
  if (Notification.permission === 'granted') return 'actif'
  return 'a-demander'
}

/**
 * La clé publique VAPID arrive en base64url et doit être remise en octets :
 * `applicationServerKey` n'accepte rien d'autre.
 */
function base64UrlVersOctets(base64: string): Uint8Array<ArrayBuffer> {
  const bourrage = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalise = (base64 + bourrage).replace(/-/g, '+').replace(/_/g, '/')
  const brut = atob(normalise)

  // Tampon alloué explicitement : `Uint8Array.from` produit un type adossé à
  // `ArrayBufferLike`, qui couvre aussi `SharedArrayBuffer` et que
  // `applicationServerKey` refuse.
  const octets = new Uint8Array(new ArrayBuffer(brut.length))
  for (let i = 0; i < brut.length; i++) octets[i] = brut.charCodeAt(i)

  return octets
}

/**
 * Demande l'autorisation puis enregistre l'abonnement auprès de l'API.
 *
 * Appelée seulement sur un geste explicite de l'utilisateur : une demande
 * d'autorisation surgie à l'ouverture est refusée par réflexe, et un refus
 * est définitif — le navigateur ne repose plus jamais la question.
 */
export async function activerNotifications(cleVapid: string): Promise<EtatNotifications> {
  if (etatNotifications() === 'non-supporte') return 'non-supporte'
  if (!cleVapid) return 'non-supporte'

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'refuse' : 'a-demander'

  try {
    const registration = await navigator.serviceWorker.ready
    const abonnement = await abonnementAvecCle(registration, cleVapid)

    await api.post('/notifications/abonnement', corpsAbonnement(abonnement))

    return 'actif'
  } catch {
    return 'a-demander'
  }
}

/** Vrai si l'abonnement a été pris avec cette clé publique. */
function memeCle(abonnement: PushSubscription, cle: Uint8Array): boolean {
  const brute = abonnement.options.applicationServerKey
  if (!brute) return false

  const prise = new Uint8Array(brute)
  return prise.length === cle.length && prise.every((octet, i) => octet === cle[i])
}

async function abonnementAvecCle(
  registration: ServiceWorkerRegistration,
  cleVapid: string,
): Promise<PushSubscription> {
  const cle = base64UrlVersOctets(cleVapid)
  const existant = await registration.pushManager.getSubscription()

  // Un abonnement existant est réutilisé : en créer un second laisse le
  // premier vivant côté navigateur, et l'utilisateur reçoit tout en double.
  if (existant && memeCle(existant, cle)) return existant

  // Pris avec une ancienne clé — après un changement des clés du serveur —,
  // il ne reçoit plus rien, et le navigateur refuse d'en ouvrir un autre
  // tant qu'il vit.
  if (existant) await existant.unsubscribe()

  return registration.pushManager.subscribe({
    // Sans cela, Chrome refuse l'abonnement : il exige que toute poussée
    // se traduise par une notification visible.
    userVisibleOnly: true,
    applicationServerKey: cle,
  })
}

/**
 * Tient l'abonnement de cet appareil à jour, à chaque visite connectée.
 *
 * Deux cas que rien ne signalait à l'utilisateur, dont le réglage restait
 * « activé » : des clés du serveur changées (l'abonnement à l'ancienne clé
 * ne reçoit plus rien, on le remplace), et un abonnement retiré côté serveur
 * — à la déconnexion ou après un changement de mot de passe —, qu'on
 * réinscrit. L'autorisation est déjà donnée, aucune question n'est reposée.
 */
export async function tenirAbonnementAJour(cleVapid: string): Promise<void> {
  if (!cleVapid || etatNotifications() !== 'actif') return

  try {
    const registration = await navigator.serviceWorker.ready
    if (!(await registration.pushManager.getSubscription())) return

    const abonnement = await abonnementAvecCle(registration, cleVapid)
    await api.post('/notifications/abonnement', corpsAbonnement(abonnement))
  } catch {
    /* La prochaine visite réessaiera. */
  }
}

/**
 * À la déconnexion : le compte cesse d'envoyer ses notifications ici. Le
 * navigateur garde son abonnement, que la prochaine connexion réinscrit.
 */
export async function retirerAbonnementDeCetAppareil(entetes?: Record<string, string>): Promise<void> {
  if (etatNotifications() !== 'actif') return

  try {
    const registration = await navigator.serviceWorker.ready
    const abonnement = await registration.pushManager.getSubscription()
    if (abonnement) {
      await api.delete('/notifications/abonnement', { data: { endpoint: abonnement.endpoint }, headers: entetes })
    }
  } catch {
    /* L'abonnement sera retiré au prochain changement de mot de passe. */
  }
}

/** Coupe les notifications sur cet appareil, des deux côtés. */
export async function desactiverNotifications(): Promise<void> {
  if (etatNotifications() === 'non-supporte') return

  try {
    const registration = await navigator.serviceWorker.ready
    const abonnement = await registration.pushManager.getSubscription()
    if (!abonnement) return

    // Le serveur d'abord : si le navigateur se désabonne et que l'API tombe,
    // il reste un abonnement mort qu'on tenterait d'appeler à chaque envoi.
    await api.delete('/notifications/abonnement', { data: { endpoint: abonnement.endpoint } })
    await abonnement.unsubscribe()
  } catch {
    /* Rien à faire de plus : l'abonnement expirera de lui-même. */
  }
}

/** Vrai si cet appareil est déjà abonné. */
export async function abonnementActif(): Promise<boolean> {
  if (etatNotifications() !== 'actif') return false

  try {
    const registration = await navigator.serviceWorker.ready
    return (await registration.pushManager.getSubscription()) !== null
  } catch {
    return false
  }
}

function corpsAbonnement(abonnement: PushSubscription) {
  const brut = abonnement.toJSON()

  return {
    endpoint: abonnement.endpoint,
    cle_p256dh: brut.keys?.p256dh ?? '',
    cle_auth: brut.keys?.auth ?? '',
    // Sert au serveur à écarter un abonnement périmé sans attendre un refus
    // du service de poussée.
    expire_le: abonnement.expirationTime ? new Date(abonnement.expirationTime).toISOString() : null,
  }
}
