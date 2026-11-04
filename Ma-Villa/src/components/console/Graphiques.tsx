import { useEffect, useId, useState, type KeyboardEvent, type PointerEvent } from 'react'

/**
 * Les graphiques du tableau de pilotage, en SVG comme ceux de `Graphe.tsx`.
 *
 * Ils portent en plus ce qu'un tableau de bord demande : un axe gradué, plusieurs
 * séries, et une infobulle qui suit le pointeur et répond aux flèches du clavier.
 * Le SVG est dessiné à la largeur réelle du conteneur : déformer le repère, comme
 * le fait `Courbe`, étirerait aussi les textes de l'axe.
 *
 * Toutes les couleurs viennent des jetons `--serie-1` à `--serie-4`, validés pour
 * le daltonisme et le contraste, en clair et en sombre. Une série garde sa
 * couleur quelle que soit la période. Pas de second axe : deux grandeurs
 * différentes font deux graphiques.
 */

export interface SerieTemps {
  cle: string
  nom: string
  couleur: string
}

export type LigneTemps = { libelle: string; date: string } & Record<string, number | string>

interface Props {
  lignes: LigneTemps[]
  series: SerieTemps[]
  forme: 'colonnes' | 'courbes'
  format?: (v: number) => string
  hauteur?: number
  titre: string
}

const MARGE = { haut: 10, droite: 8, bas: 24, gauche: 44 }

/**
 * Le plus petit maximum « rond » au-dessus de la valeur, dont la moitié reste un
 * entier : la graduation du milieu ne doit pas annoncer sept demandes et demie.
 */
function maximumRond(v: number): number {
  if (v <= 4) return 4
  const puissance = 10 ** Math.floor(Math.log10(v))
  for (const pas of [1, 1.2, 1.6, 2, 2.4, 3, 4, 5, 6, 8, 10]) {
    const m = Math.round(pas * puissance)
    if (m >= v && Number.isInteger(m / 2)) return m
  }
  return 10 * puissance
}

function nombreCourt(v: number): string {
  const virgule = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')
  if (v >= 1_000_000) return `${virgule(v / 1_000_000)} M`
  if (v >= 1000) return `${virgule(v / 1000)} k`
  return String(v)
}

/**
 * La largeur d'un élément. Une réf posée par état, et non `useRef` : le graphique
 * n'existe pas tant qu'il n'y a rien à dessiner, et l'observation doit commencer
 * quand il apparaît, pas au montage.
 */
function useLargeur<T extends HTMLElement>() {
  const [noeud, setNoeud] = useState<T | null>(null)
  const [largeur, setLargeur] = useState(0)
  useEffect(() => {
    if (!noeud) return
    const observateur = new ResizeObserver(([e]) => setLargeur(Math.round(e.contentRect.width)))
    observateur.observe(noeud)
    return () => observateur.disconnect()
  }, [noeud])
  return { ref: setNoeud, largeur }
}

/** Une colonne au sommet arrondi, posée sur sa base : le rayon ne déborde jamais. */
function colonneArrondie(x: number, y: number, l: number, h: number, r: number): string {
  const rayon = Math.min(r, l / 2, h)
  return `M${x} ${y + h}V${y + rayon}Q${x} ${y} ${x + rayon} ${y}H${x + l - rayon}Q${x + l} ${y} ${x + l} ${y + rayon}V${y + h}Z`
}

export function GrapheTemps({ lignes, series, forme, format = String, hauteur = 220, titre }: Props) {
  const { ref, largeur } = useLargeur<HTMLDivElement>()
  const [actif, setActif] = useState<number | null>(null)
  const idLegende = useId()

  const valeur = (l: LigneTemps, cle: string) => Number(l[cle] ?? 0)
  const totaux = series.map((s) => lignes.reduce((t, l) => t + valeur(l, s.cle), 0))
  const total = totaux.reduce((t, v) => t + v, 0)

  const legende = (
    <ul className="graphique-legende" id={idLegende}>
      {series.map((s, i) => (
        <li key={s.cle}>
          <span
            className={forme === 'colonnes' ? 'graphique-cle' : 'graphique-cle est-trait'}
            style={{ background: s.couleur }}
            aria-hidden="true"
          />
          <span className="graphique-cle-nom">{s.nom}</span>
          <span className="graphique-cle-valeur">{format(totaux[i])}</span>
        </li>
      ))}
    </ul>
  )

  if (lignes.length === 0 || total === 0) {
    return <p className="graphe-vide">Rien sur cette période.</p>
  }

  const L = Math.max(largeur, 240)
  const H = hauteur
  const zoneL = L - MARGE.gauche - MARGE.droite
  const zoneH = H - MARGE.haut - MARGE.bas

  const sommets = lignes.map((l) => (forme === 'colonnes'
    ? series.reduce((t, s) => t + valeur(l, s.cle), 0)
    : Math.max(...series.map((s) => valeur(l, s.cle)))))
  const max = maximumRond(Math.max(...sommets, 1))
  const y = (v: number) => MARGE.haut + zoneH - (v / max) * zoneH

  const pasX = zoneL / lignes.length
  const centre = (i: number) => MARGE.gauche + pasX * (i + 0.5)
  const largeurColonne = Math.max(2, Math.min(28, pasX - 2))

  // Assez d'étiquettes pour se repérer, jamais assez pour qu'elles se touchent.
  const tous = Math.max(1, Math.ceil(lignes.length / Math.max(1, Math.floor(zoneL / 52))))

  const viser = (e: PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.floor(((e.clientX - r.left) / r.width) * lignes.length)
    setActif(Math.max(0, Math.min(lignes.length - 1, i)))
  }

  const clavier = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    setActif((a) => {
      const depart = a ?? (e.key === 'ArrowLeft' ? lignes.length : -1)
      return Math.max(0, Math.min(lignes.length - 1, depart + (e.key === 'ArrowRight' ? 1 : -1)))
    })
  }

  const ligneActive = actif === null ? null : lignes[actif]
  const aDroite = actif !== null && centre(actif) > L / 2

  return (
    <figure className="graphique" style={{ margin: 0 }}>
      {legende}
      <div
        ref={ref}
        className="graphique-zone"
        tabIndex={0}
        role="img"
        aria-label={`${titre}. ${series.map((s, i) => `${s.nom} : ${format(totaux[i])}`).join(', ')}. Flèches gauche et droite pour lire chaque période ; le détail est aussi dans le tableau « Par période ».`}
        onKeyDown={clavier}
        onBlur={() => setActif(null)}
      >
        <svg width={L} height={H} viewBox={`0 0 ${L} ${H}`} className="graphique-svg" aria-hidden="true">
          {[0, 0.5, 1].map((r) => (
            <g key={r}>
              <line className="graphe-grille" x1={MARGE.gauche} x2={L - MARGE.droite} y1={y(max * r)} y2={y(max * r)} />
              <text className="graphique-axe" x={MARGE.gauche - 6} y={y(max * r) + 4} textAnchor="end">{nombreCourt(max * r)}</text>
            </g>
          ))}

          {forme === 'colonnes' && lignes.map((l, i) => {
            const x = centre(i) - largeurColonne / 2
            let cumul = 0
            const presentes = series.filter((s) => valeur(l, s.cle) > 0)
            return (
              <g key={l.date} opacity={actif === null || actif === i ? 1 : 0.55}>
                {presentes.map((s, j) => {
                  const v = valeur(l, s.cle)
                  const bas = y(cumul)
                  cumul += v
                  const haut = y(cumul)
                  // 2 px de surface entre deux segments : la couleur seule ne les sépare pas.
                  const h = Math.max(1, bas - haut - (j > 0 ? 2 : 0))
                  return j === presentes.length - 1
                    ? <path key={s.cle} d={colonneArrondie(x, bas - h - (j > 0 ? 2 : 0), largeurColonne, h, 4)} fill={s.couleur} />
                    : <rect key={s.cle} x={x} y={bas - h - (j > 0 ? 2 : 0)} width={largeurColonne} height={h} fill={s.couleur} />
                })}
              </g>
            )
          })}

          {forme === 'courbes' && series.map((s) => (
            <polyline
              key={s.cle}
              fill="none"
              stroke={s.couleur}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={lignes.map((l, i) => `${centre(i).toFixed(1)},${y(valeur(l, s.cle)).toFixed(1)}`).join(' ')}
            />
          ))}

          {actif !== null && (
            <>
              <line className="graphique-viseur" x1={centre(actif)} x2={centre(actif)} y1={MARGE.haut} y2={MARGE.haut + zoneH} />
              {forme === 'courbes' && series.map((s) => (
                <circle key={s.cle} cx={centre(actif)} cy={y(valeur(lignes[actif], s.cle))} r={4} fill={s.couleur} className="graphique-point" />
              ))}
            </>
          )}

          {lignes.map((l, i) => (i % tous === 0 ? (
            <text key={l.date} className="graphique-axe" x={centre(i)} y={H - 6} textAnchor="middle">{l.libelle}</text>
          ) : null))}

          {/* Toute la zone répond : on vise une date, jamais un trait de 2 px. */}
          <rect
            x={MARGE.gauche}
            y={MARGE.haut}
            width={zoneL}
            height={zoneH}
            fill="transparent"
            style={{ touchAction: 'pan-y' }}
            onPointerMove={viser}
            onPointerDown={viser}
            onPointerLeave={() => setActif(null)}
          />
        </svg>

        {ligneActive && actif !== null && (
          <div
            className="graphique-bulle"
            style={aDroite ? { right: L - centre(actif) + 10 } : { left: centre(actif) + 10 }}
          >
            <p className="graphique-bulle-titre">{ligneActive.libelle}</p>
            {series.map((s) => (
              <p key={s.cle} className="graphique-bulle-ligne">
                <span className="graphique-cle est-trait" style={{ background: s.couleur }} aria-hidden="true" />
                <strong>{format(valeur(ligneActive, s.cle))}</strong>
                <span>{s.nom}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </figure>
  )
}

/* ── Du contact à l'argent ───────────────────────────────────── */

/**
 * Un entonnoir en barres alignées à gauche : on y lit les longueurs, et le taux de
 * passage d'une étape à l'autre est écrit, parce que c'est lui qu'on cherche.
 */
export function Entonnoir({ etapes }: { etapes: { cle: string; libelle: string; valeur: number }[] }) {
  const max = Math.max(...etapes.map((e) => e.valeur), 1)
  if (etapes.every((e) => e.valeur === 0)) return <p className="graphe-vide">Rien sur cette période.</p>

  return (
    <ol className="entonnoir">
      {etapes.map((e, i) => {
        const avant = i > 0 ? etapes[i - 1].valeur : null
        return (
          <li key={e.cle} className="barre-ligne">
            <div className="barre-entete">
              <span className="barre-nom">{e.libelle}</span>
              <span className="barre-valeur">
                {e.valeur}
                {avant ? ` · ${Math.round((e.valeur / avant) * 100)} % de l’étape d’avant` : ''}
              </span>
            </div>
            <div className="barre-piste">
              <div className="barre-remplissage" style={{ width: `${(e.valeur / max) * 100}%` }} />
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/* ── Quand les demandes arrivent ─────────────────────────────── */

/**
 * Une carte de chaleur à une seule teinte, écrite comme un tableau : chaque case
 * dit son chiffre, et un lecteur d'écran la parcourt comme n'importe quelle grille.
 */
export function CarteChaleur({ jours, creneaux, grille }: { jours: string[]; creneaux: string[]; grille: number[][] }) {
  const max = Math.max(...grille.flat(), 0)
  if (max === 0) return <p className="graphe-vide">Rien sur cette période.</p>

  return (
    <div className="tableau-cadre">
      <table className="chaleur">
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">Jour</span></th>
            {creneaux.map((c) => <th key={c} scope="col">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {jours.map((j, i) => (
            <tr key={j}>
              <th scope="row">{j}</th>
              {grille[i].map((v, k) => (
                <td
                  key={creneaux[k]}
                  title={`${j}, ${creneaux[k]} : ${v} demande${v > 1 ? 's' : ''}`}
                  style={v ? { background: `color-mix(in srgb, var(--serie-1) ${Math.round(12 + (v / max) * 48)}%, transparent)` } : undefined}
                >
                  {v || ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
