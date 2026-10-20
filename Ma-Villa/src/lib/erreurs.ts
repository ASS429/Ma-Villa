import { AxiosError } from 'axios'

/**
 * Traduit une erreur d'API en un message affichable.
 * Le code avalait les erreurs (`.catch(() => {})`) : quand l'API tombait,
 * l'utilisateur voyait un écran vide sans explication ni moyen de réessayer.
 */
/**
 * Les erreurs de validation, rangées par champ.
 *
 * `messageErreur` aplatit tout en une phrase, ce qui convient à un écran de
 * liste mais pas à un formulaire : un message qui parle du mot de passe
 * affiché au-dessus de l'adresse oblige à lire pour comprendre où corriger.
 * Le serveur sait de quel champ il parle ; autant s'en servir.
 *
 * Renvoie un objet vide quand l'erreur n'est pas une erreur de validation —
 * l'appelant retombe alors sur `messageErreur`.
 */
export function erreursParChamp(erreur: unknown): Record<string, string> {
  if (!(erreur instanceof AxiosError) || !erreur.response) return {}

  const champs = (erreur.response.data as { errors?: Record<string, string[]> })?.errors
  if (!champs) return {}

  return Object.fromEntries(
    Object.entries(champs)
      .map(([champ, messages]) => [champ, messages[0]])
      .filter(([, message]) => Boolean(message))
  )
}

/**
 * Les messages génériques, dans les deux langues des pages client.
 *
 * La langue se lit sur `<html lang>`, que `LangueDocument` tient à jour : la
 * fonction est appelée de partout, souvent hors d'un composant, et lui faire
 * passer la langue aurait touché chaque appel. Les messages de validation du
 * serveur restent en français — ils viennent tels quels de l'API.
 */
const MESSAGES = {
  fr: {
    defaut: 'Une erreur est survenue.',
    horsLigne: 'Vous semblez hors ligne. Vérifiez votre connexion et réessayez.',
    lent: 'Le serveur met trop de temps à répondre. Réessayez dans un instant.',
    injoignable: 'Le serveur est injoignable. Réessayez dans un instant.',
    401: 'Vous devez être connecté pour effectuer cette action.',
    403: "Vous n'avez pas les droits nécessaires.",
    404: 'Élément introuvable.',
    409: 'Cette action entre en conflit avec une donnée existante.',
    429: 'Trop de tentatives. Patientez un instant.',
    5: 'Le service est momentanément indisponible. Réessayez dans quelques instants.',
  },
  en: {
    defaut: 'Something went wrong.',
    horsLigne: 'You seem to be offline. Check your connection and try again.',
    lent: 'The server is taking too long to answer. Try again in a moment.',
    injoignable: 'The server cannot be reached. Try again in a moment.',
    401: 'You need to be logged in to do this.',
    403: 'You are not allowed to do this.',
    404: 'Not found.',
    409: 'This conflicts with existing data.',
    429: 'Too many attempts. Please wait a moment.',
    5: 'The service is temporarily unavailable. Try again in a few moments.',
  },
}

function messages() {
  return typeof document !== 'undefined' && document.documentElement.lang === 'en' ? MESSAGES.en : MESSAGES.fr
}

export function messageErreur(erreur: unknown, repli?: string): string {
  const m = messages()
  const parDefaut = repli ?? m.defaut

  if (!(erreur instanceof AxiosError)) {
    return erreur instanceof Error ? erreur.message : parDefaut
  }

  // Aucune réponse reçue. Trois pannes très différentes se cachaient derrière
  // un message unique — appareil hors ligne, serveur trop lent, requête coupée —
  // et les confondre rendait le diagnostic impossible : le client décrit ce
  // qu'il voit, et « vérifiez votre réseau » envoyait chercher au mauvais endroit.
  if (!erreur.response) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return m.horsLigne
    }

    if (erreur.code === 'ECONNABORTED' || erreur.code === 'ETIMEDOUT') {
      return m.lent
    }

    return m.injoignable
  }

  const { status, data } = erreur.response

  // Erreurs de validation Laravel : on remonte la première, la plus utile.
  const errors = (data as { errors?: Record<string, string[]> })?.errors
  if (errors) {
    const premiere = Object.values(errors).flat()[0]
    if (premiere) return premiere
  }

  const message = (data as { message?: string })?.message
  if (message && message !== 'Server Error') return message

  switch (status) {
    case 401: return m[401]
    case 403: return m[403]
    case 404: return m[404]
    case 409: return m[409]
    case 429: return m[429]
    case 500:
    case 502:
    case 503: return m[5]
    default: return parDefaut
  }
}

/** Vrai si l'erreur vient du réseau et non d'une réponse du serveur. */
export function estErreurReseau(erreur: unknown): boolean {
  return erreur instanceof AxiosError && !erreur.response
}
