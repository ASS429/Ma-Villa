import { useMemo } from 'react'
import qrcode from 'qrcode-generator'

// La bibliothèque encode en ISO-8859-1 par défaut : un caractère accentué dans
// l'URL produisait alors un code qui se lit — et qui rend une chaîne vide.
// Vérifié en décodant réellement les codes produits, pas en les regardant.
qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8']

/**
 * Code QR d'une URL de paiement, dessiné localement.
 *
 * Un service distant de génération aurait été plus court à écrire, mais il
 * verrait passer chaque lien de paiement — un lien qui permet de payer — et
 * placerait un tiers dans le chemin critique de l'encaissement. Une coupure
 * chez lui deviendrait une coupure chez nous.
 *
 * Correction d'erreur au niveau M : le compromis habituel, qui tolère un écran
 * sale ou un reflet sans gonfler la densité au point de gêner la lecture.
 */
export default function CodeQR({ valeur, taille = 200 }: { valeur: string; taille?: number }) {
  const { chemin, modules } = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(valeur)
    qr.make()

    const n = qr.getModuleCount()
    let d = ''

    for (let ligne = 0; ligne < n; ligne++) {
      for (let colonne = 0; colonne < n; colonne++) {
        if (qr.isDark(ligne, colonne)) {
          d += `M${colonne} ${ligne}h1v1h-1z`
        }
      }
    }

    return { chemin: d, modules: n }
  }, [valeur])

  // La marge blanche de quatre modules fait partie de la spécification : sans
  // elle, beaucoup de lecteurs ne trouvent pas les repères d'angle.
  const marge = 4
  const cote = modules + marge * 2

  return (
    <div className="code-qr" style={{ width: taille, height: taille }}>
      <svg
        viewBox={`0 0 ${cote} ${cote}`}
        width={taille}
        height={taille}
        role="img"
        aria-label="Code QR à scanner avec votre téléphone pour payer"
        shapeRendering="crispEdges"
      >
        <rect width={cote} height={cote} fill="#ffffff" />
        <g transform={`translate(${marge} ${marge})`}>
          <path d={chemin} fill="#000000" />
        </g>
      </svg>
    </div>
  )
}
