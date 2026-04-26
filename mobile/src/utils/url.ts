import { API_BASE } from '../config'

/**
 * Le backend génère les URLs avec APP_URL=http://localhost:8000.
 * Sur mobile, localhost = le téléphone lui-même. On remplace par l'IP réelle du serveur.
 */
export function fixUrl(url: string | undefined | null): string {
  if (!url) return ''
  return url
    .replace('http://localhost:8000', API_BASE)
    .replace('http://127.0.0.1:8000', API_BASE)
}
