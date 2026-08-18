import { useEffect, useState } from 'react'
import { Bell, BellOff, BellRing } from 'lucide-react'
import { useConfig } from '../../context/ConfigContext'
import { useToast } from '../../context/ToastContext'
import {
  abonnementActif,
  activerNotifications,
  desactiverNotifications,
  etatNotifications,
  type EtatNotifications,
} from '../../lib/pwa'
import Button from '../ui/Button'

/**
 * Active ou coupe les notifications sur *cet appareil*.
 *
 * L'abonnement appartient au navigateur, pas au compte : le même propriétaire
 * peut vouloir être prévenu sur son téléphone et pas sur l'ordinateur du
 * bureau. Le libellé dit donc « cet appareil » — sans quoi couper ici
 * paraîtrait tout couper.
 *
 * Rien n'est demandé à l'ouverture de la page. Une demande d'autorisation
 * surgie sans geste est refusée par réflexe, et un refus est définitif : le
 * navigateur ne repose plus jamais la question.
 */
export default function ReglageNotifications() {
  const config = useConfig()
  const toast = useToast()
  // Lu à l'initialisation plutôt que dans un effet : c'est une valeur que le
  // navigateur connaît déjà, et la poser après coup provoquerait un rendu de
  // plus, visible sous la forme d'un bouton qui change d'état tout seul.
  const [etat, setEtat] = useState<EtatNotifications>(etatNotifications)
  const [abonne, setAbonne] = useState(false)
  const [occupe, setOccupe] = useState(false)

  useEffect(() => {
    let vivant = true
    // Asynchrone, donc hors du corps de l'effet : `getSubscription` interroge
    // le service worker.
    abonnementActif().then((actif) => { if (vivant) setAbonne(actif) })

    return () => { vivant = false }
  }, [])

  // Sans clés VAPID côté serveur, la fonction est dormante : afficher un
  // bouton qui échouerait vaut moins que ne rien afficher du tout.
  if (!config.notifications.actives || etat === 'non-supporte') return null

  const activer = async () => {
    setOccupe(true)
    const resultat = await activerNotifications(config.notifications.cle_publique ?? '')
    setEtat(resultat)
    setAbonne(resultat === 'actif')
    setOccupe(false)

    if (resultat === 'actif') toast.succes('Notifications activées sur cet appareil.')
    else if (resultat === 'refuse') toast.info('Les notifications sont bloquées dans les réglages du navigateur.')
    else toast.erreur("L'activation n'a pas abouti. Réessayez.")
  }

  const couper = async () => {
    setOccupe(true)
    await desactiverNotifications()
    setAbonne(false)
    setOccupe(false)
    toast.info('Notifications coupées sur cet appareil.')
  }

  const bloque = etat === 'refuse'

  return (
    <div className="reglage-notif">
      <div className="reglage-notif-icone" aria-hidden="true">
        {abonne ? <BellRing size={19} /> : bloque ? <BellOff size={19} /> : <Bell size={19} />}
      </div>

      <div className="reglage-notif-texte">
        <p className="reglage-notif-titre">Notifications sur cet appareil</p>
        <p className="reglage-notif-detail">
          {bloque
            ? "Vous avez refusé les notifications pour ce site. Elles se réactivent depuis les réglages du navigateur, à la ligne « Notifications »."
            : abonne
              ? 'Vous êtes prévenu ici dès qu’une réservation avance : demande reçue, confirmation, paiement.'
              : 'Soyez prévenu dès qu’une réservation avance, sans garder l’onglet ouvert.'}
        </p>
      </div>

      {!bloque && (
        <Button
          variante={abonne ? 'secondaire' : 'primaire'}
          taille="sm"
          onClick={abonne ? couper : activer}
          disabled={occupe}
          chargement={occupe}
        >
          {abonne ? 'Couper' : 'Activer'}
        </Button>
      )}
    </div>
  )
}
