import { Link } from 'react-router-dom'
import { Languages } from 'lucide-react'
import { memoriserLangue, useLangue } from './langue'
import { COMMUN } from './commun'

/**
 * Passer à l'autre langue, sur la même page.
 *
 * Un lien, pas un bouton : l'autre version a sa propre adresse, et le
 * visiteur peut l'ouvrir ailleurs ou la partager. Le choix est mémorisé
 * pour lui proposer sa langue la prochaine fois.
 *
 * `compact` : « EN » / « FR » seul, pour l'en-tête — visible sans ouvrir le
 * menu, parce qu'un visiteur qui ne lit pas le français ne cherchera pas
 * « Menu » pour trouver sa langue.
 */
export default function ChoixLangue({
  compact = false,
  className,
  style,
}: {
  compact?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const { autre, versAutre } = useLangue()
  const t = COMMUN.fr.langue

  return (
    <Link
      to={versAutre}
      replace
      hrefLang={autre}
      lang={autre}
      aria-label={compact ? t.versionDans[autre] : undefined}
      className={className ?? (compact ? 'commande-entete text-xs font-semibold' : 'btn btn-secondaire btn-sm')}
      style={style}
      onClick={() => memoriserLangue(autre)}
    >
      {compact ? t.court[autre] : (
        <>
          <Languages size={15} aria-hidden="true" />
          <span>{t.nom[autre]}</span>
        </>
      )}
    </Link>
  )
}
