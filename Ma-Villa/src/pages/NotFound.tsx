import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: 'var(--bg)', color: 'var(--text-1)' }}
    >
      <p className="text-8xl font-semibold mb-6 select-none" style={{ color: 'var(--border-2)' }}>
        404
      </p>
      <h1 className="text-2xl font-normal mb-3">Page introuvable</h1>
      <p className="th-text-3 text-sm mb-10 max-w-xs leading-relaxed">
        La page que vous cherchez n'existe pas ou a été déplacée.
      </p>
      <div className="flex gap-4">
        <Link
          to="/"
          className="px-6 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90 hover:scale-[1.02]"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
        >
          Accueil
        </Link>
        <Link
          to="/villas"
          className="px-6 py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-[1.02]"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-1)',
          }}
        >
          Voir les villas
        </Link>
      </div>
    </div>
  )
}
