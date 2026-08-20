/**
 * Écran d'attente plein cadre.
 *
 * Extrait d'`App.tsx`, où il servait de repli aux routes chargées à la demande.
 * Les écrans de la boutique en ont besoin pour une autre raison : ils doivent
 * attendre de **savoir** si la boutique est ouverte avant de rediriger. Sans
 * cette attente, le premier rendu — configuration pas encore arrivée — renvoyait
 * à l'accueil alors que la boutique était bien ouverte.
 */
export default function ChargementPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-8 h-8 rounded-full animate-spin"
          style={{ border: '2px solid var(--border)', borderTopColor: 'var(--accent)' }}
        />
        <p className="text-sm th-text-2">Chargement…</p>
      </div>
    </div>
  )
}
