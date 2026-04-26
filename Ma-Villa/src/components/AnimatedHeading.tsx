import { useEffect, useState } from 'react'

interface AnimatedHeadingProps {
  text: string
  className?: string
  style?: React.CSSProperties
}

const CHAR_DELAY = 30
const START_DELAY = 200
const TRANSITION_DURATION = 500

export default function AnimatedHeading({ text, className = '', style }: AnimatedHeadingProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), START_DELAY)
    return () => clearTimeout(timer)
  }, [])

  const lines = text.split('\n')

  return (
    <h1 className={className} style={style}>
      {lines.map((line, lineIndex) => {
        const chars = line.split('')
        const lineLength = chars.length
        return (
          <span key={lineIndex} className="block">
            {chars.map((char, charIndex) => {
              const delay = lineIndex * lineLength * CHAR_DELAY + charIndex * CHAR_DELAY
              return (
                <span
                  key={charIndex}
                  className="inline-block"
                  style={{
                    opacity: visible ? 1 : 0,
                    transform: visible ? 'translateX(0)' : 'translateX(-18px)',
                    transition: `opacity ${TRANSITION_DURATION}ms ease ${delay}ms, transform ${TRANSITION_DURATION}ms ease ${delay}ms`,
                  }}
                >
                  {char === ' ' ? '\u00A0' : char}
                </span>
              )
            })}
          </span>
        )
      })}
    </h1>
  )
}
