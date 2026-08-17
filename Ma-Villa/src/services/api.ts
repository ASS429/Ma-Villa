import axios from 'axios'

/**
 * Adresse de l'API, exportée : le téléversement de fichiers passe par `fetch`
 * et non par cette instance — il doit laisser le navigateur poser lui-même
 * l'en-tête `multipart/form-data` avec sa frontière. Sans cette constante
 * partagée, l'adresse finit recopiée à la main, et la copie reste sur
 * localhost.
 */
export const URL_API = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8000/api'

const api = axios.create({
  baseURL: URL_API,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 20_000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')

      // Une 401 sur une page publique (consultation des favoris d'un visiteur
      // déconnecté, par exemple) ne doit pas éjecter vers /login : seules les
      // pages privées le justifient, et il faut revenir là où on était.
      const chemin = window.location.pathname
      const estPagePrivee = chemin.startsWith('/dashboard') || chemin.startsWith('/admin')

      if (estPagePrivee) {
        const retour = encodeURIComponent(chemin + window.location.search)
        window.location.href = `/login?retour=${retour}`
      }
    }
    return Promise.reject(error)
  }
)

export default api
