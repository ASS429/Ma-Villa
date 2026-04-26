import { useEffect, useRef } from 'react'

interface Props {
  children: React.ReactNode
  className?: string
  delay?: number
  as?: keyof React.JSX.IntrinsicElements
}

export default function ScrollReveal({ children, className = '', delay = 0, as: Tag = 'div' }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => el.classList.add('sr-visible'), delay)
          io.unobserve(el)
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -32px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [delay])

  const isStagger = className.includes('sr-stagger')

  return (
    // @ts-expect-error polymorphic ref
    <Tag ref={ref} className={`${isStagger ? '' : 'sr-init '}${className}`}>
      {children}
    </Tag>
  )
}
