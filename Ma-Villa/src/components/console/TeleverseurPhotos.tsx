import { useRef, useState } from 'react'
import { Trash2, Upload } from 'lucide-react'
import api from '../../services/api'
import { televerserFichier } from '../../services/televerser'
import { messageErreur } from '../../lib/erreurs'
import type { Photo } from '../../types'
import Button from '../ui/Button'

interface Props {
  photos: (Photo & { id?: number })[]
  /** Où poster le lot de photos une fois les fichiers envoyés. */
  cheminAjout: string
  /** Construit l'adresse de suppression d'une photo donnée. */
  cheminSuppression: (photoId: number) => string
  /** Appelé après tout changement, pour que l'écran se recharge. */
  onChange: () => void
}

/**
 * Téléversement de photos, en deux temps.
 *
 * Les fichiers partent d'abord vers le stockage, qui rend des URL ; les URL
 * sont ensuite rattachées à l'objet. C'est le trajet qu'emprunte déjà la
 * gestion des villas, et le seul que l'API accepte — elle attend des adresses,
 * pas des fichiers.
 *
 * Les erreurs sont affichées, jamais avalées : sans cela, l'attente s'arrête
 * et les photos manquent, sans que rien ne dise pourquoi.
 */
export default function TeleverseurPhotos({ photos, cheminAjout, cheminSuppression, onChange }: Props) {
  const champ = useRef<HTMLInputElement>(null)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState('')

  const ajouter = async (fichiers: FileList | null) => {
    if (!fichiers || fichiers.length === 0) return

    setEnvoi(true)
    setErreur('')
    try {
      const lot = []
      for (let i = 0; i < fichiers.length; i++) {
        lot.push({
          url: await televerserFichier(fichiers[i]),
          alt: fichiers[i].name,
          ordre: photos.length + i,
        })
      }
      await api.post(cheminAjout, { photos: lot })
      onChange()
    } catch (err) {
      setErreur(messageErreur(err, "L'ajout de photos a échoué."))
    } finally {
      setEnvoi(false)
      if (champ.current) champ.current.value = ''
    }
  }

  const supprimer = async (photoId: number) => {
    setErreur('')
    try {
      await api.delete(cheminSuppression(photoId))
      onChange()
    } catch (err) {
      setErreur(messageErreur(err, 'La photo n\'a pas pu être supprimée.'))
    }
  }

  return (
    <div className="televerseur">
      {erreur && <p className="conversation-erreur" role="alert">{erreur}</p>}

      <input
        ref={champ}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        onChange={(e) => ajouter(e.target.files)}
      />

      <Button
        variante="secondaire"
        taille="sm"
        onClick={() => champ.current?.click()}
        disabled={envoi}
        chargement={envoi}
        iconeAvant={<Upload size={15} />}
      >
        Ajouter des photos
      </Button>

      {photos.length > 0 && (
        <ul className="televerseur-liste">
          {photos.map((p, i) => (
            <li key={p.id ?? p.url}>
              <img src={p.url} alt={p.alt || ''} loading="lazy" />
              {/* La première sert de vignette partout : le dire évite de
                  chercher comment la choisir. */}
              {i === 0 && <span className="televerseur-marque">Vignette</span>}
              {p.id !== undefined && (
                <button
                  type="button"
                  className="televerseur-supprimer"
                  onClick={() => supprimer(p.id as number)}
                  aria-label={`Supprimer la photo ${i + 1}`}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
