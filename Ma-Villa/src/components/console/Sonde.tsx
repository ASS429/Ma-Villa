/**
 * Briques d'affichage des sondes d'administration.
 *
 * Extraites de l'écran d'encaissement pour servir aussi aux notifications :
 * deux sondes qui se ressemblent doivent se lire pareil, et corriger l'une ne
 * doit pas laisser l'autre en arrière.
 */

export function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="panneau" style={{ marginBottom: 'var(--space-4)' }}>
      <h2 className="panneau-titre">{titre}</h2>
      {children}
    </section>
  )
}

export function Ligne({ libelle, valeur, bon }: { libelle: string; valeur: string; bon?: boolean }) {
  return (
    <div
      className="flex items-baseline justify-between gap-4 py-2 text-sm"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <span className="th-text-2">{libelle}</span>
      <span
        className="font-medium text-right"
        style={{ color: bon === undefined ? 'var(--text-1)' : bon ? 'var(--success)' : 'var(--danger)' }}
      >
        {valeur}
      </span>
    </div>
  )
}

export function Alerte({ ton, children }: { ton: 'succes' | 'danger'; children: React.ReactNode }) {
  const couleur = ton === 'succes' ? 'var(--success)' : 'var(--danger)'

  return (
    <p
      className="rounded-xl px-4 py-3 text-sm mb-4"
      role={ton === 'danger' ? 'alert' : 'status'}
      style={{
        background: `color-mix(in srgb, ${couleur} 10%, transparent)`,
        border: `1px solid color-mix(in srgb, ${couleur} 25%, transparent)`,
        color: couleur,
      }}
    >
      {children}
    </p>
  )
}
