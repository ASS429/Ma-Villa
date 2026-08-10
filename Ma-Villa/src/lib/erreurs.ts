import { AxiosError } from 'axios'

/**
 * Traduit une erreur d'API en un message affichable.
 * Le code avalait les erreurs (`.catch(() => {})`) : quand l'API tombait,
 * l'utilisateur voyait un écran vide sans explication ni moyen de réessayer.
 */
export function messageErreur(erreur: unknown, repli = 'Une erreur est survenue.'): string {
  if (!(erreur instanceof AxiosError)) {
    return erreur instanceof Error ? erreur.message : repli
  }

  // Réseau injoignable : cas fréquent en mobilité, il mérite son propre message.
  if (!erreur.response) {
    return 'Connexion impossible. Vérifiez votre réseau et réessayez.'
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
