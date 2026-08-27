import { Heart, Compass } from 'lucide-react'
import api from '../../services/api'
import { useRequete } from '../../lib/useRequete'
import { useToast } from '../../context/ToastContext'
import { messageErreur } from '../../lib/erreurs'
import VillaCard from '../../components/VillaCard'
import ListeConsole from '../../components/console/ListeConsole'
import { ButtonLink } from '../../components/ui/Button'
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
      <ListeConsole
        titre="Mes favoris"
        sousTitre={favoris.length > 0
          ? `${favoris.length} logement${favoris.length > 1 ? 's' : ''} enregistré${favoris.length > 1 ? 's' : ''}`
          : 'Les logements que vous mettez de côté.'}
        chargement={chargement}
        erreur={erreur}
        reessayer={reessayer}
        vide={favoris.length === 0}
        videIcone={Heart}
        videTexte={<>
          <strong>Aucun favori pour l'instant.</strong> Le cœur sur une annonce la range ici,
          pour la retrouver sans refaire la recherche.
        </>}
        videAction={
          <ButtonLink to="/villas" variante="primaire" taille="sm" iconeAvant={<Compass size={15} />}>
            Explorer les villas
          </ButtonLink>
        }
      >
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
      </ListeConsole>
    </div>
  )
}
