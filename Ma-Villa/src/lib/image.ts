/**
 * Réduction d'image, dans le navigateur, avant l'envoi.
 *
 * Planche 37 : « L'échec dit la cause en deux mots et propose la réparation. »
 * Un propriétaire qui photographie avec son téléphone produit des fichiers de
 * 8 Mo. Les refuser bloque l'annonce — la sonde de stockage en tenait dix-sept.
 *
 * Réduire **avant** l'envoi plutôt qu'après l'échec : sur un forfait payé au
 * volume, envoyer 8 Mo pour se les faire refuser coûte de l'argent à celui qui
 * publie. La réparation proposée après coup reste en secours, pour les cas où
 * le serveur refuse malgré tout.
 *
 * Les vidéos ne sont jamais touchées : un canvas ne sait pas les réencoder, et
 * les recompresser côté navigateur donnerait un résultat pire que l'original.
 */

/** Au-delà, on réduit. En deçà, l'image part telle quelle. */
const SEUIL_OCTETS = 2 * 1024 * 1024

/** 1600 px : la plus grande largeur réellement affichée, celle du hero. */
const LARGEUR_MAX = 1600

const QUALITE = 0.82

export function estImage(fichier: File): boolean {
  return /^image\/(jpeg|png|webp)$/.test(fichier.type)
}

export function doitEtreReduite(fichier: File): boolean {
  return estImage(fichier) && fichier.size > SEUIL_OCTETS
}

/** « 8,4 Mo » — pour dire la cause en deux mots. */
export function poidsLisible(octets: number): string {
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`
  return `${(octets / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`
}

/**
 * Rend une version allégée, ou le fichier d'origine si la réduction échoue ou
 * ne gagne rien.
 *
 * Ne lève jamais : une réduction ratée ne doit pas empêcher la publication.
 * Dans le doute, on envoie l'original — le serveur tranchera.
 */
export async function reduireImage(fichier: File): Promise<File> {
  if (!doitEtreReduite(fichier)) return fichier

  try {
    const bitmap = await creerBitmap(fichier)

    const echelle = Math.min(1, LARGEUR_MAX / bitmap.width)
    const largeur = Math.round(bitmap.width * echelle)
    const hauteur = Math.round(bitmap.height * echelle)

    const toile = document.createElement('canvas')
    toile.width = largeur
    toile.height = hauteur

    const pinceau = toile.getContext('2d')
    if (!pinceau) return fichier

    pinceau.drawImage(bitmap, 0, 0, largeur, hauteur)
    bitmap.close?.()

    const blob = await new Promise<Blob | null>((resoudre) =>
      toile.toBlob(resoudre, 'image/jpeg', QUALITE)
    )

    // Une réduction qui n'allège pas n'a pas lieu d'être : certains PNG déjà
    // optimisés grossissent en JPEG.
    if (!blob || blob.size >= fichier.size) return fichier

    return new File([blob], renommerEnJpeg(fichier.name), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } catch {
    return fichier
  }
}

async function creerBitmap(fichier: File): Promise<ImageBitmap> {
  // `createImageBitmap` applique l'orientation EXIF : sans elle, une photo
  // prise en portrait ressort couchée.
  if ('createImageBitmap' in window) {
    return createImageBitmap(fichier, { imageOrientation: 'from-image' })
  }

  // Repli pour les navigateurs sans `createImageBitmap`.
  const url = URL.createObjectURL(fichier)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return await createImageBitmap(img)
  } finally {
    URL.revokeObjectURL(url)
  }
}

function renommerEnJpeg(nom: string): string {
  return nom.replace(/\.[^.]+$/, '') + '.jpg'
}
