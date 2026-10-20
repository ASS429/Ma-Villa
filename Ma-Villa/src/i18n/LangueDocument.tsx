import { useEffect } from 'react'
import { useLangue } from './langue'

/**
 * Tient `<html lang>` à jour avec la langue de la page.
 *
 * Un lecteur d'écran lit selon cet attribut : une page anglaise annoncée
 * `fr` est prononcée avec l'accent français, mot à mot, et devient
 * incompréhensible.
 */
export default function LangueDocument() {
  const { langue } = useLangue()

  useEffect(() => {
    document.documentElement.lang = langue
  }, [langue])

  return null
}
