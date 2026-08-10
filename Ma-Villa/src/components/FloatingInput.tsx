import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'

interface FloatingInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label: string
  error?: string
  rightElement?: ReactNode
}

export default function FloatingInput({ label, error, rightElement, ...props }: FloatingInputProps) {
  const [focused, setFocused] = useState(false)
  const [hasValue, setHasValue] = useState(!!props.value || !!props.defaultValue)

  // Le libellé flottant n'était rattaché à aucun champ : les lecteurs d'écran
  // annonçaient un champ sans nom, et cliquer sur le libellé ne focalisait rien.
  const idGenere = useId()
  const inputId = props.id ?? idGenere
  const idErreur = `${inputId}-erreur`

  const floated = focused || hasValue || !!props.value

  return (
    <div className="relative">
      <input
        {...props}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? idErreur : undefined}
        onFocus={(e) => { setFocused(true); props.onFocus?.(e) }}
        onBlur={(e)  => { setFocused(false); setHasValue(!!e.target.value); props.onBlur?.(e) }}
        placeholder=""
        style={{
          width: '100%',
          paddingLeft: '1rem',
          paddingRight: rightElement ? '3rem' : '1rem',
          paddingTop: '1.5rem',
          paddingBottom: '0.625rem',
          borderRadius: '0.75rem',
          fontSize: '0.9375rem',
          background: 'var(--bg-input)',
          border: `1px solid ${error ? 'rgb(239,68,68)' : focused ? 'var(--accent)' : 'var(--border)'}`,
          color: 'var(--text-1)',
          boxShadow: focused && !error ? '0 0 0 3px var(--accent-bg)' : 'none',
          outline: 'none',
          transition: 'border-color 200ms ease, box-shadow 200ms ease',
        }}
      />

      <label
        htmlFor={inputId}
        style={{
          position: 'absolute',
          left: '1rem',
          pointerEvents: 'none',
          transition: 'all 180ms cubic-bezier(0.4, 0, 0.2, 1)',
          color: error ? 'rgb(239,68,68)' : focused ? 'var(--accent)' : 'var(--text-3)',
          ...(floated
            ? { top: '0.45rem', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }
            : { top: '50%', transform: 'translateY(-50%)', fontSize: '0.9375rem' }
          ),
        }}
      >
        {label}
      </label>

      {rightElement && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {rightElement}
        </div>
      )}

      {error && (
        <p className="mt-1.5 text-xs flex items-center gap-1" style={{ color: 'rgb(239,68,68)' }}>
          <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
}
