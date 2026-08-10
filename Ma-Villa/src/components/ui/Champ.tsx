import { useId, type ComponentPropsWithoutRef, type ReactNode } from 'react'

interface CommunChamp {
  label: string
  /** Texte d'aide affiché sous le champ. */
  aide?: string
  erreur?: string
  /** Masque le libellé visuellement sans le retirer aux lecteurs d'écran. */
  labelMasque?: boolean
}

/**
 * Enveloppe libellé + contrôle + message d'erreur, avec l'attelage
 * d'accessibilité correct : `htmlFor`, `aria-invalid`, `aria-describedby`.
 *
 * Les formulaires de l'application recopiaient ce balisage à la main, souvent
 * avec un `<label>` non relié à son champ — un lecteur d'écran annonçait alors
 * un champ sans nom, et cliquer sur le libellé ne donnait pas le focus.
 */
function Enveloppe({
  label, aide, erreur, labelMasque, inputId, children,
}: CommunChamp & { inputId: string; children: ReactNode }) {
  return (
    <div className="champ">
      <label htmlFor={inputId} className={labelMasque ? 'sr-only' : 'champ-label'}>
        {label}
      </label>
      {children}
      {aide && !erreur && <p id={`${inputId}-aide`} className="champ-aide">{aide}</p>}
      {erreur && (
        <p id={`${inputId}-erreur`} className="champ-erreur" role="alert">
          <span aria-hidden="true">⚠</span>
          {erreur}
        </p>
      )}
    </div>
  )
}

function decritPar(inputId: string, aide?: string, erreur?: string) {
  if (erreur) return `${inputId}-erreur`
  if (aide) return `${inputId}-aide`
  return undefined
}

type ProprietesTexte = CommunChamp & Omit<ComponentPropsWithoutRef<'input'>, 'id'> & { id?: string }

export function Champ({ label, aide, erreur, labelMasque, id, className, ...reste }: ProprietesTexte) {
  const genere = useId()
  const inputId = id ?? genere

  return (
    <Enveloppe label={label} aide={aide} erreur={erreur} labelMasque={labelMasque} inputId={inputId}>
      <input
        {...reste}
        id={inputId}
        className={`champ-controle ${className ?? ''}`}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={decritPar(inputId, aide, erreur)}
      />
    </Enveloppe>
  )
}

type ProprietesSelection = CommunChamp & Omit<ComponentPropsWithoutRef<'select'>, 'id'> & { id?: string }

export function ChampSelection({ label, aide, erreur, labelMasque, id, className, children, ...reste }: ProprietesSelection) {
  const genere = useId()
  const inputId = id ?? genere

  return (
    <Enveloppe label={label} aide={aide} erreur={erreur} labelMasque={labelMasque} inputId={inputId}>
      <select
        {...reste}
        id={inputId}
        className={`champ-controle ${className ?? ''}`}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={decritPar(inputId, aide, erreur)}
      >
        {children}
      </select>
    </Enveloppe>
  )
}

type ProprietesZone = CommunChamp & Omit<ComponentPropsWithoutRef<'textarea'>, 'id'> & { id?: string }

export function ChampZoneTexte({ label, aide, erreur, labelMasque, id, className, ...reste }: ProprietesZone) {
  const genere = useId()
  const inputId = id ?? genere

  return (
    <Enveloppe label={label} aide={aide} erreur={erreur} labelMasque={labelMasque} inputId={inputId}>
      <textarea
        {...reste}
        id={inputId}
        className={`champ-controle ${className ?? ''}`}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={decritPar(inputId, aide, erreur)}
      />
    </Enveloppe>
  )
}
