import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import api from '../services/api'
import { useAuth } from './AuthContext'

interface Valeur {
  /** Total des messages non lus, tous fils confondus. */
  total: number
  /** Non lus par réservation, pour la pastille d'une carte. */
  parReservation: Record<number, number>
  /** À appeler après avoir lu ou écrit : le compteur redescend aussitôt. */
  rafraichir: () => void
}

const Contexte = createContext<Valeur>({ total: 0, parReservation: {}, rafraichir: () => {} })

/** Toutes les 60 s : assez pour ne pas rater un message, assez peu pour ne pas
 *  peser sur un forfait mobile payé au volume. */
const PERIODE = 60_000

/**
 * Compteur de messages non lus, chargé une fois pour tout l'espace personnel.
 *
 * La navigation et la liste des réservations ont toutes deux besoin du même
 * chiffre. Sans ce partage, chaque écran ferait sa propre requête — deux
 * allers-retours pour une seule information, sur un serveur mono-processus.
 */
export function MessagesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [total, setTotal] = useState(0)
  const [parReservation, setParReservation] = useState<Record<number, number>>({})
  const [tick, setTick] = useState(0)

  const rafraichir = useCallback(() => setTick((t) => t + 1), [])

  // Le compteur ne doit jamais faire échouer un écran : c'est un ornement.
  // Une erreur réseau le laisse simplement à sa dernière valeur connue.
  const monte = useRef(true)
  useEffect(() => {
    monte.current = true
    return () => { monte.current = false }
  }, [])

  useEffect(() => {
    if (!user) {
      // Effet de bord assumé de la déconnexion : sans cette remise à zéro, la
      // pastille du compte précédent survivrait à l'écran de connexion.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTotal(0)
      setParReservation({})
      return
    }

    const controleur = new AbortController()

    const charger = async () => {
      try {
        const { data } = await api.get('/messages/non-lus', { signal: controleur.signal })
        if (!monte.current) return
        setTotal(data.total ?? 0)
        setParReservation(data.par_reservation ?? {})
      } catch {
        // Silence assumé, et le seul de tout le code : voir ci-dessus.
      }
    }

    charger()

    // Le relevé s'arrête quand l'onglet passe en arrière-plan : inutile de
    // consommer de la data pour une pastille que personne ne regarde.
    const minuteur = setInterval(() => {
      if (document.visibilityState === 'visible') charger()
    }, PERIODE)

    const auRetour = () => { if (document.visibilityState === 'visible') charger() }
    document.addEventListener('visibilitychange', auRetour)

    return () => {
      controleur.abort()
      clearInterval(minuteur)
      document.removeEventListener('visibilitychange', auRetour)
    }
  }, [user, tick])

  const valeur = useMemo(
    () => ({ total, parReservation, rafraichir }),
    [total, parReservation, rafraichir]
  )

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- convention des modules de contexte : le hook vit auprès de son provider
export function useMessages() {
  return useContext(Contexte)
}
