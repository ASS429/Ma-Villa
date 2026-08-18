/**
 * Graphiques de la console — dessinés à la main en SVG.
 *
 * Aucune bibliothèque : Chart.js coûte environ 70 Ko gzip pour trois courbes.
 * Sur ce marché la data est payée au volume, et une console d'administration
 * n'est pas l'écran où l'on accepte de payer ce prix. Même raisonnement que le
 * refus du WebGL et que le code QR dessiné localement plutôt qu'appelé à un
 * service tiers.
 *
 * Le tracé est en coordonnées relatives avec `preserveAspectRatio="none"` :
 * le graphe s'étire à la largeur disponible sans qu'on ait à mesurer le
 * conteneur ni à réagir au redimensionnement.
 */

interface Point {
  libelle: string
  valeur: number
}

interface ProprietesCourbe {
  points: Point[]
  /** Mis en forme pour l'infobulle native et la description accessible. */
  format?: (v: number) => string
  hauteur?: number
  titreAccessible: string
}

const L = 300 // largeur du repère interne
const MARGE = 4

/**
 * Courbe d'évolution sur trente jours.
 *
 * Les jours à zéro sont présents dans les données : une série trouée se
 * dessinerait comme une droite entre deux points éloignés, ce qui inventerait
 * une activité qui n'a pas eu lieu.
 */
export function Courbe({ points, format = String, hauteur = 120, titreAccessible }: ProprietesCourbe) {
  const total = points.reduce((s, p) => s + p.valeur, 0)

  if (points.length === 0 || total === 0) {
    return (
      <p className="graphe-vide">
        Aucune donnée sur les trente derniers jours.
      </p>
    )
  }

  const max = Math.max(...points.map((p) => p.valeur))
  const H = hauteur

  // Le maximum est ramené à l'échelle ; un plancher à 1 évite la division par
  // zéro quand toutes les valeurs sont égales.
  const echelle = (v: number) => H - MARGE - (v / Math.max(max, 1)) * (H - MARGE * 2)
  const abscisse = (i: number) => (i / Math.max(points.length - 1, 1)) * L

  const trace = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${abscisse(i).toFixed(1)} ${echelle(p.valeur).toFixed(1)}`).join(' ')
  const aire = `${trace} L ${L} ${H} L 0 ${H} Z`

  const dernier = points[points.length - 1]

  return (
    <figure style={{ margin: 0 }}>
      <svg
        className="graphe"
        viewBox={`0 0 ${L} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${titreAccessible} — maximum ${format(max)}, dernier jour ${format(dernier.valeur)}`}
      >
        {/* Trois repères horizontaux : assez pour situer une valeur, pas
            assez pour encombrer un graphe de 120 px de haut. */}
        {[0.25, 0.5, 0.75].map((r) => (
          <line key={r} className="graphe-grille" x1={0} x2={L} y1={H * r} y2={H * r} vectorEffect="non-scaling-stroke" />
        ))}

        <path className="graphe-aire" d={aire} />
        <path className="graphe-trait" d={trace} vectorEffect="non-scaling-stroke" />
      </svg>

      {/* Les extrémités seules : trente étiquettes seraient illisibles sur
          un écran de téléphone. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span className="graphe-legende" style={{ fontSize: 11 }}>{points[0].libelle}</span>
        <span className="graphe-legende" style={{ fontSize: 11 }}>{dernier.libelle}</span>
      </div>
    </figure>
  )
}

interface ProprietesBarres {
  lignes: { nom: string; valeur: number }[]
  format?: (v: number) => string
}

/**
 * Répartition en barres horizontales.
 *
 * Préférées à un camembert : on y compare des longueurs alignées sur une même
 * base, là où un camembert demande de comparer des angles — ce que l'œil fait
 * mal, surtout au-delà de quatre parts.
 */
export function Barres({ lignes, format = String }: ProprietesBarres) {
  if (lignes.length === 0) {
    return <p className="graphe-vide">Aucune villa publiée pour l'instant.</p>
  }

  const max = Math.max(...lignes.map((l) => l.valeur), 1)

  return (
    <ul className="barres">
      {lignes.map(({ nom, valeur }) => (
        <li key={nom} className="barre-ligne">
          <div className="barre-entete">
            <span className="barre-nom">{nom}</span>
            <span className="barre-valeur">{format(valeur)}</span>
          </div>
          <div
            className="barre-piste"
            role="meter"
            aria-valuenow={valeur}
            aria-valuemin={0}
            aria-valuemax={max}
            aria-label={nom}
          >
            <div className="barre-remplissage" style={{ width: `${(valeur / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
