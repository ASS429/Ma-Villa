import axios from 'axios'
import { useCallback, useEffect, useRef, useState } from 'react'
import { messageErreur } from './erreurs'

interface Etat<T> {
  donnees: T | null
  chargement: boolean
  erreur: string
}

/**
 * Chargement de données : un état unique (données / chargement / erreur) plutôt
 * que trois `useState` recopiés dans chaque page, requête annulée au démontage,
 * et un `reessayer()` pour offrir une sortie quand l'API tombe.
 *
 * Le code avalait ses erreurs (`.catch(() => {})`) : l'écran restait vide, sans
 * explication ni moyen de réessayer.
 *
 * @param cle chaîne identifiant la requête ; la relance quand elle change
 *            (typiquement la query string des filtres, ou un identifiant).
 */
export function useRequete<T>(
  charger: (signal: AbortSignal) => Promise<T>,
  cle: string,
  options: { messageErreurParDefaut?: string } = {}
) {
  const [etat, setEtat] = useState<Etat<T>>({ donnees: null, chargement: true, erreur: '' })
  const [tentative, setTentative] = useState(0)

  // La fonction est recréée à chaque rendu : on la lit via une réf pour que
  // seule `cle` décide d'une relance. La réf est mise à jour dans un effet
  // déclaré avant celui du chargement, donc exécuté avant lui.
  const chargerRef = useRef(charger)
  useEffect(() => { chargerRef.current = charger })

  const messageParDefaut = options.messageErreurParDefaut
  const reessayer = useCallback(() => setTentative((t) => t + 1), [])

  useEffect(() => {
    const controleur = new AbortController()

    // Repasser en « chargement » est un effet de bord assumé du départ de la
    // requête : sans lui, l'écran garderait les résultats précédents.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEtat((e) => ({ ...e, chargement: true, erreur: '' }))

    chargerRef.current(controleur.signal)
      .then((donnees) => {
        if (controleur.signal.aborted) return
        setEtat({ donnees, chargement: false, erreur: '' })
      })
      .catch((err) => {
        // Une requête annulée (navigation, filtre changé) n'est pas une erreur.
        if (controleur.signal.aborted || axios.isCancel(err)) return
        setEtat({ donnees: null, chargement: false, erreur: messageErreur(err, messageParDefaut) })
      })

    return () => controleur.abort()
  }, [cle, tentative, messageParDefaut])

  return { ...etat, reessayer }
}
