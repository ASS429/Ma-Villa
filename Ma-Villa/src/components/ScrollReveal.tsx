import { useEffect, useRef } from 'react'

interface Props {
  children: React.ReactNode
  className?: string
  delay?: number
  as?: keyof React.JSX.IntrinsicElements
}

/**
 * Révèle son contenu quand il entre dans l'écran.
 *
 * ⚠️ Le contenu part à `opacity: 0` : c'est du JavaScript que dépend sa
 * visibilité. Deux garde-fous en découlent, et ils ne sont pas facultatifs.
 *
 * **1. Le seuil est en pixels, pas en proportion.** Un seuil de 8 % porte sur
 * la hauteur de l'élément observé. Sur la page de résultats, la grille des
 * villas mesure près de 5 000 px : les ~300 px visibles sous l'en-tête n'en
 * représentent que 6 %, le seuil n'était donc jamais atteint et la page
 * s'ouvrait sur une grille vide sous le texte « 20 villas trouvées ». Il
 * fallait défiler pour faire apparaître ce qu'on était venu voir.
 * `threshold: 0` déclenche dès le premier pixel — la seule règle qui ne dépende
 * pas de la taille du contenu.
 *
 * **2. Un filet de sécurité.** Observateur absent, écarté par un réglage, ou
 * élément jamais intersecté pour une raison qu'on n'a pas prévue : le contenu
 * doit apparaître quand même. Une animation ratée est un détail ; un catalogue
 * invisible est une panne.
 */
export default function ScrollReveal({ children, className = '', delay = 0, as: Tag = 'div' }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const reveler = () => el.classList.add('sr-visible')

    if (typeof IntersectionObserver === 'undefined') {
      reveler()
      return
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setTimeout(reveler, delay)
        io.unobserve(el)
      },
      // Marge basse positive : la révélation commence juste avant que
      // l'élément n'atteigne le bord, pour qu'il soit déjà en place quand
      // l'œil y arrive.
      { threshold: 0, rootMargin: '0px 0px 80px 0px' }
    )
    io.observe(el)

    // Sans nouvelle au bout d'une seconde et demie, on montre. Ce délai laisse
    // le temps à l'animation normale de se produire dans la très grande
    // majorité des cas, sans jamais laisser un écran vide s'installer.
    const filet = setTimeout(reveler, 1500)

    return () => {
      io.disconnect()
      clearTimeout(filet)
    }
  }, [delay])

  const isStagger = className.includes('sr-stagger')

  return (
    // @ts-expect-error polymorphic ref
    <Tag ref={ref} className={`${isStagger ? '' : 'sr-init '}${className}`}>
      {children}
    </Tag>
  )
}
