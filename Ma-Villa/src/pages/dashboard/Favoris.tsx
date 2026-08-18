import { Heart, Compass } from 'lucide-react'
import api from '../../services/api'
import { useRequete } from '../../lib/useRequete'
import { useToast } from '../../context/ToastContext'
import { messageErreur } from '../../lib/erreurs'
import VillaCard from '../../components/VillaCard'
import Button, { ButtonLink } from '../../components/ui/Button'
import type { VillaResume } from '../../types'

interface Favori {
  id: number
  villa_id: number
  villa: VillaResume
}

export default function Favoris() {
  const toast = useToast()

  const { donnees, chargement, erreur, reessayer } = useRequete<Favori[]>(
    async (signal) => (await api.get('/favoris', { signal })).data,
    'favoris',
    { messageErreurParDefaut: 'Impossible de charger vos favoris.' }
  )

  const favoris = donnees ?? []

  const retirer = async (villaId: number, nom: string) => {
    try {
      await api.delete(`/villas/${villaId}/favoris`)
      toast.info(`« ${nom} » retirée de vos favoris.`)
      reessayer()
    } catch (err) {
      // Le retrait était fait dans l'état local sans attendre le serveur : en
      // cas d'échec, la villa disparaissait de l'écran mais restait en base,
      // et revenait au rechargement suivant.
      toast.erreur(messageErreur(err, "La villa n'a pas pu être retirée."))
    }
  }

  return (
    <div>
      <h1 className="console-titre">Mes favoris</h1>
      <p className="console-sous-titre">
        {favoris.length > 0
          ? `${favoris.length} logement${favoris.length > 1 ? 's' : ''} enregistré${favoris.length > 1 ? 's' : ''}`
          : 'Les logements que vous mettez de côté.'}
      </p>

      {erreur && !chargement && (
        <div className="console-erreur" role="alert">
          {erreur}
          <Button variante="secondaire" taille="sm" onClick={reessayer}>Réessayer</Button>
        </div>
      )}

      {chargement ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="panneau">
              <div className="skeleton" style={{ aspectRatio: '4 / 3', borderRadius: 12, marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 14, width: '60%', borderRadius: 6 }} />
            </div>
          ))}
        </div>
      ) : favoris.length === 0 ? (
        <div className="console-vide">
          <span className="console-vide-icone"><Heart size={22} /></span>
          <p>
            <strong>Aucun favori pour l'instant.</strong> Le cœur sur une annonce la range ici,
            pour la retrouver sans refaire la recherche.
          </p>
          <ButtonLink to="/villas" variante="primaire" taille="sm" iconeAvant={<Compass size={15} />}>
            Explorer les villas
          </ButtonLink>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 cascade">
          {favoris.map((f) => (
            <VillaCard
              key={f.id}
              villa={f.villa}
              isFavori
              onToggleFavori={(e) => {
                e.preventDefault()
                retirer(f.villa_id, f.villa.nom)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
