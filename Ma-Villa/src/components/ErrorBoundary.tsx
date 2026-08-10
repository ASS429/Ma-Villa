import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  erreur: Error | null
}

/**
 * Sans cette frontière, une exception de rendu vide l'écran entièrement :
 * l'utilisateur se retrouve devant une page blanche, sans explication ni
 * moyen de repartir.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { erreur: null }

  static getDerivedStateFromError(erreur: Error): State {
    return { erreur }
  }

  componentDidCatch(erreur: Error, infos: ErrorInfo) {
    console.error('Erreur de rendu', erreur, infos.componentStack)
  }

  render() {
    if (!this.state.erreur) return this.props.children

    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{ background: 'var(--bg)', color: 'var(--text-1)' }}
      >
        <div className="max-w-md text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: 'var(--bg-elevated)' }}
          >
            <svg className="w-8 h-8" style={{ color: 'var(--text-3)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-xl font-medium mb-2">Une erreur inattendue s'est produite</h1>
          <p className="text-sm th-text-2 mb-8 leading-relaxed">
            Nous sommes désolés. Vous pouvez recharger la page ou revenir à l'accueil.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Recharger
            </button>
            <a
              href="/"
              className="px-5 py-2.5 rounded-xl text-sm font-medium th-text-1 transition-colors"
              style={{ border: '1px solid var(--border-2)', textDecoration: 'none' }}
            >
              Accueil
            </a>
          </div>
        </div>
      </div>
    )
  }
}
