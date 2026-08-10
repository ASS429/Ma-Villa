import { useConfig } from '../context/ConfigContext'

/**
 * Annonce les moyens de paiement à venir, sans jamais laisser croire qu'un
 * règlement en ligne est possible : tant que le serveur renvoie
 * `paiement.actif = false`, le texte dit explicitement que le règlement se fait
 * avec le propriétaire.
 *
 * Quand la stratégie d'encaissement sera arrêtée, il suffira de passer
 * PAIEMENT_ACTIF à true côté API — le parcours de paiement viendra se brancher
 * ici, sans redéployer le front.
 */
export default function MoyensPaiement({ compact = false }: { compact?: boolean }) {
  const { paiement } = useConfig()
  const noms = paiement.moyens.map((m) => m.nom).join(' et ')

  if (paiement.actif) {
    return (
      <p className="text-xs th-text-2 leading-relaxed">
        Paiement sécurisé par {noms}.
      </p>
    )
  }

  if (compact) {
    return (
      <p className="text-xs th-text-3 leading-relaxed">
        Règlement directement avec le propriétaire.{' '}
        <span className="th-text-2">Paiement en ligne ({noms}) bientôt disponible.</span>
      </p>
    )
  }

  return (
    <div
      className="rounded-xl px-4 py-3 flex items-start gap-3"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
    >
      <svg
        className="w-4 h-4 shrink-0 mt-0.5"
        style={{ color: 'var(--accent)' }}
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        aria-hidden="true"
      >
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </svg>
      <div className="text-xs leading-relaxed">
        <p className="th-text-1 font-medium mb-0.5">
          Paiement en ligne bientôt disponible
        </p>
        <p className="th-text-2">
          {noms} arrivent prochainement. Pour l'instant, le règlement se fait
          directement avec le propriétaire, qui vous contactera après confirmation.
        </p>
      </div>
    </div>
  )
}
