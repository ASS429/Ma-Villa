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

export function messageErreur(erreur: unknown, repli = 'Une erreur est survenue.'): string {
  if (!(erreur instanceof AxiosError)) {
    return erreur instanceof Error ? erreur.message : repli
  }

  // Aucune réponse reçue. Trois pannes très différentes se cachaient derrière
  // un message unique — appareil hors ligne, serveur trop lent, requête coupée —
  // et les confondre rendait le diagnostic impossible : le client décrit ce
  // qu'il voit, et « vérifiez votre réseau » envoyait chercher au mauvais endroit.
  if (!erreur.response) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return 'Vous semblez hors ligne. Vérifiez votre connexion et réessayez.'
    }

    if (erreur.code === 'ECONNABORTED' || erreur.code === 'ETIMEDOUT') {
      return 'Le serveur met trop de temps à répondre. Réessayez dans un instant.'
    }

    return 'Le serveur est injoignable. Réessayez dans un instant.'
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
    case 401: return 'Vous devez être connecté pour effectuer cette action.'
    case 403: return "Vous n'avez pas les droits nécessaires."
    case 404: return 'Élément introuvable.'
    case 409: return 'Cette action entre en conflit avec une donnée existante.'
    case 429: return 'Trop de tentatives. Patientez un instant.'
    case 500:
    case 502:
    case 503: return 'Le service est momentanément indisponible. Réessayez dans quelques instants.'
    default: return repli
  }
}

/** Vrai si l'erreur vient du réseau et non d'une réponse du serveur. */
export function estErreurReseau(erreur: unknown): boolean {
  return erreur instanceof AxiosError && !erreur.response
}
