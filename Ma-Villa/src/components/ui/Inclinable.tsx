import { useCallback, useRef } from 'react'

interface Props {
  children: React.ReactNode
  className?: string
  /** Amplitude maximale, en degrés. Au-delà de 8, la carte se tord. */
  amplitude?: number
  /** Halo lumineux qui suit le curseur. Coûteux : réservé aux cartes larges. */
  reflet?: boolean
  as?: 'div' | 'article' | 'li'
}

/**
 * Surface qui s'incline vers le curseur, et laisse passer une lumière.
 *
 * L'inclinaison est écrite en variables CSS plutôt qu'en style de transformation :
 * le navigateur garde alors l'animation sur le compositeur, sans repasser par
 * la mise en page ni le dessin. C'est ce qui permet d'en avoir douze à l'écran
 * sans faire tomber la fréquence d'images.
 *
 * Trois refus assumés :
 *
 * - **Rien au doigt.** Sans curseur il n'y a pas de direction à suivre, et un
 *   plan 3D permanent coûte une couche de rendu pour un effet que personne ne
 *   voit. Le filtre est en CSS (`hover: hover`), pas en JavaScript.
 * - **Pas de `requestAnimationFrame`.** Poser une variable CSS est déjà
 *   synchronisé avec le rendu ; une file d'attente n'ajouterait que du code.
 * - **Aucune information portée.** Retirer l'effet laisse la carte entière.
 */
export default function Inclinable({
  children,
  className = '',
  amplitude = 6,
  reflet = false,
  as: Balise = 'div',
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  const suivre = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const el = ref.current
      if (!el) return

      const cadre = el.getBoundingClientRect()

      // Position du curseur ramenée dans [-0,5 ; 0,5] depuis le centre.
      const x = (e.clientX - cadre.left) / cadre.width - 0.5
      const y = (e.clientY - cadre.top) / cadre.height - 0.5

      // L'axe X s'incline à l'inverse du déplacement vertical : monter le
      // curseur doit faire basculer le haut de la carte vers l'arrière, comme
      // un objet posé qu'on regarderait de plus haut.
      el.style.setProperty('--incline-x', `${-y * amplitude}deg`)
      el.style.setProperty('--incline-y', `${x * amplitude}deg`)

      if (reflet) {
        el.style.setProperty('--lumiere-x', `${(x + 0.5) * 100}%`)
        el.style.setProperty('--lumiere-y', `${(y + 0.5) * 100}%`)
      }
    },
    [amplitude, reflet]
  )

  const entrer = useCallback(() => {
    // La transition est retirée pendant le suivi : la laisser ferait poursuivre
    // le curseur avec un retard élastique, et l'effet paraîtrait mou.
    ref.current?.classList.add('est-suivie')
  }, [])

  const quitter = useCallback(() => {
    const el = ref.current
    if (!el) return

    // La transition est remise avant la remise à plat : c'est elle qui rend le
    // retour progressif au lieu d'un claquement.
    el.classList.remove('est-suivie')
    el.style.setProperty('--incline-x', '0deg')
    el.style.setProperty('--incline-y', '0deg')
  }, [])

  return (
    <Balise
      ref={ref as React.Ref<never>}
      className={`inclinable ${reflet ? 'inclinable-reflet' : ''} ${className}`.trim()}
      onMouseEnter={entrer}
      onMouseMove={suivre}
      onMouseLeave={quitter}
    >
      {children}
    </Balise>
  )
}
