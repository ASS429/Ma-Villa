import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  erreur: Error | null
}

/**
 * Le client était-il en train de payer ?
 *
 * C'est la seule question qui change ce qu'il faut lui dire. Une panne pendant
 * un règlement fait craindre un débit sans réservation — et cette crainte
 * produit un appel, puis une opposition bancaire. Une phrase la dissipe.
 *
 * Lue au moment du rendu, pas capturée à l'avance : la frontière ne sait pas
 * d'où vient l'exception, seulement où se trouvait l'utilisateur.
 */
function pendantUnPaiement(): boolean {
  const chemin = window.location.pathname
  return chemin.includes('/paiement') || chemin.endsWith('/commander')
}

/**
 * Sans cette frontière, une exception de rendu vide l'écran entièrement :
 * l'utilisateur se retrouve devant une page blanche, sans explication ni
 * moyen de repartir.
 *
 * Le texte suit la planche 31 : **« quelque chose a cassé chez nous »**, et
 * jamais « une erreur inattendue s'est produite ». La seconde formule est
 * exacte et vide — elle n'apprend rien, et surtout elle laisse croire que la
 * faute pourrait venir de l'utilisateur.
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

    const enPaiement = pendantUnPaiement()

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

          <h1 className="text-xl font-medium mb-2">Quelque chose a cassé chez nous</h1>
          <p className="text-sm th-text-2 mb-6 leading-relaxed">
            Ce n'est pas votre appareil ni votre connexion. Réessayez dans un instant —
            si cela recommence, écrivez-nous.
          </p>

          {/* La phrase qui compte, et elle ne s'affiche qu'au bon moment :
              la servir à tout le monde inquiéterait ceux qui ne payaient pas. */}
          {enPaiement && (
            <p
              className="text-sm mb-8 leading-relaxed rounded-xl px-4 py-3"
              style={{
                background: 'color-mix(in srgb, var(--success) 10%, transparent)',
                color: 'var(--text-1)',
              }}
              role="status"
            >
              <strong>Aucun paiement n'a été prélevé.</strong> Vérifiez vos réservations
              avant de recommencer.
            </p>
          )}

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
            >
              Réessayer
            </button>

            <a
              href={enPaiement ? '/dashboard/reservations' : '/'}
              className="px-5 py-2.5 rounded-xl text-sm font-medium th-text-1 transition-colors"
              style={{ border: '1px solid var(--border-2)', textDecoration: 'none' }}
            >
              {enPaiement ? 'Mes réservations' : 'Accueil'}
            </a>
          </div>
        </div>
      </div>
    )
  }
}
