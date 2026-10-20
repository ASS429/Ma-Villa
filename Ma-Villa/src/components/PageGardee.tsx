import { Navigate } from 'react-router-dom'
import { Eye } from 'lucide-react'
import ChargementPage from './ChargementPage'
import { useOuverture } from '../lib/ouverture'
import { useLangue } from '../i18n/langue'

/**
 * Une page qui n'existe que si son module est ouvert.
 *
 * Fermée, elle renvoie à l'accueil, dans la langue de la page : ses liens ont
 * pu circuler sur WhatsApp, et une page d'erreur perdrait celui qui les suit.
 * L'administrateur, lui, la voit en aperçu, avec un bandeau qui dit qu'elle
 * est fermée et quelle variable l'ouvre — pour qu'un aperçu ne passe jamais
 * pour une ouverture.
 */
export default function PageGardee({
  ouvert,
  variable,
  children,
}: {
  ouvert: boolean
  /** La variable Railway qui l'ouvre, citée dans le bandeau d'aperçu. */
  variable: string
  children: React.ReactNode
}) {
  const ouverture = useOuverture(ouvert)
  const { lien } = useLangue()

  if (ouverture === 'inconnu') return <ChargementPage />
  if (ouverture === 'ferme') return <Navigate to={lien('/')} replace />

  return (
    <>
      {ouverture === 'apercu' && <AvisApercu variable={variable} />}
      {children}
    </>
  )
}

/** Le bandeau d'aperçu. En français : seul l'administrateur le voit. */
export function AvisApercu({ variable }: { variable: string }) {
  return (
    <div
      role="status"
      lang="fr"
      className="px-6 py-2.5 text-sm flex items-center justify-center gap-2 text-center"
      style={{ background: 'var(--accent-bg)', color: 'var(--text-1)', borderBottom: '1px solid var(--border)' }}
    >
      <Eye size={15} aria-hidden="true" />
      <span>
        Aperçu administrateur — fermé au public. Pour ouvrir : <code>{variable}=true</code> sur Railway.
      </span>
    </div>
  )
}
