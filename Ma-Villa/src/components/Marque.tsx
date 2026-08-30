import { Link } from 'react-router-dom'

type Taille = 'sm' | 'md' | 'lg'

/**
 * La marque : le logo et le nom, ensemble, toujours cliquables vers l'accueil.
 *
 * Ils étaient recopiés dans neuf fichiers, et avaient divergé — le logo dans la
 * barre publique, le nom seul dans la console et le pied de page, le logo seul
 * sur les écrans d'authentification, et deux tiroirs mobiles où le nom n'était
 * même pas un lien. Un composant unique fait disparaître la question.
 *
 * Le lien porte un libellé explicite : « PasseTemps » lu seul ne dit pas où il
 * mène, et c'est le premier élément que rencontre un lecteur d'écran.
 */
export default function Marque({
  taille = 'md',
  role,
  sombre = false,
  colonne = false,
  className = '',
  onClick,
}: {
  taille?: Taille
  /** Mention accolée au nom, « Admin » par exemple. */
  role?: string
  /** Sur une photo : le nom passe en blanc. */
  sombre?: boolean
  /** Logo au-dessus du nom, pour les écrans d'authentification. */
  colonne?: boolean
  className?: string
  onClick?: () => void
}) {
  const classes = [
    'marque',
    `marque-${taille}`,
    sombre ? 'marque-sur-image' : '',
    colonne ? 'marque-colonne' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <Link to="/" className={classes} aria-label="PasseTemps — retour à l'accueil" onClick={onClick}>
      <img
        src="/logo.webp"
        alt=""
        aria-hidden="true"
        width={72}
        height={72}
        className="marque-icone"
      />
      <span className="marque-nom">PasseTemps</span>
      {role && <span className="marque-role">{role}</span>}
    </Link>
  )
}
