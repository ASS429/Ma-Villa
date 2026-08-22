import { useEffect, useState } from 'react'
import { Download, Share, Plus, X } from 'lucide-react'
import { aReserve } from '../../lib/installation'
import {
  demanderInstallation,
  estIOS,
  estInstallee,
  installationPossible,
  surChangementInstallation,
} from '../../lib/pwa'

const CLE_REFUS = 'installation-refusee-le'

/** Un refus vaut six mois de silence. Redemander plus tôt est du harcèlement. */
const DELAI_APRES_REFUS = 180 * 24 * 3600 * 1000



function refusRecent(): boolean {
  try {
    const le = localStorage.getItem(CLE_REFUS)
    return le !== null && Date.now() - Number(le) < DELAI_APRES_REFUS
  } catch {
    return false
  }
}

/** Safari est le seul navigateur iOS où le geste « écran d'accueil » existe. */
function safariIOS(): boolean {
  return estIOS() && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent)
}

/**
 * Faut-il proposer l'installation dès le premier rendu ?
 *
 * Trois refus, et il faut les respecter tous les trois : déjà installée,
 * refusée dans les six derniers mois, ou pas encore de réservation. Une
 * bannière qui surgit à la première seconde se fait refuser une fois pour
 * toutes — et le navigateur ne redonne jamais de seconde chance.
 */
function proposerDEntree(): boolean {
  if (estInstallee() || refusRecent()) return false
  if (!aReserve()) return false

  return safariIOS() || installationPossible()
}

/**
 * Propose de garder Ma Villa sur l'écran d'accueil.
 *
 * **Non modale, sans voile, refermable** — planche 36. Ce n'est pas une
 * superposition : elle ne vole pas la mise au point, ne bloque rien, et se
 * laisse ignorer. L'invitation d'installation est la superposition la plus
 * détestée du web mobile ; celle-ci n'en est pas une.
 *
 * Elle attend la première réservation confirmée, et son argument est
 * vérifiable : les réservations restent consultables sans connexion.
 */
export default function InvitationInstallation() {
  // Décidé à l'initialisation : tout ce dont dépend la réponse est déjà connu
  // du navigateur, et l'établir dans un effet ferait apparaître la bannière
  // après coup, au milieu de la lecture.
  const [visible, setVisible] = useState(proposerDEntree)

  // Sur iOS aucune invitation n'est programmable : la seule chose utile est
  // d'expliquer le geste, et seulement dans Safari où il existe.
  const [ios] = useState(safariIOS)

  useEffect(() => {
    // Chrome émet `beforeinstallprompt` souvent après le premier rendu :
    // l'abonnement rattrape ce cas, et couvre aussi l'installation faite
    // depuis le menu du navigateur, qui doit retirer la bannière.
    if (ios) return

    return surChangementInstallation((dispo) => {
      setVisible(dispo && !refusRecent() && aReserve())
    })
  }, [ios])

  if (!visible) return null

  const refuser = () => {
    try {
      localStorage.setItem(CLE_REFUS, String(Date.now()))
    } catch {
      /* Navigation privée : le refus ne tiendra que la session. */
    }
    setVisible(false)
  }

  const installer = async () => {
    const accepte = await demanderInstallation()
    if (!accepte) refuser()
    setVisible(false)
  }

  return (
    // `complementary` et non `dialog` : rien n'est bloqué, rien n'attend de
    // réponse. Un lecteur d'écran l'annonce comme un complément, pas comme une
    // interruption à traiter.
    <aside className="invite-install" aria-labelledby="invite-install-titre">
      <img src="/icon-192.png" alt="" width={44} height={44} className="invite-install-icone" />

      <div className="invite-install-texte">
        <p id="invite-install-titre" className="invite-install-titre">
          Garder Ma Villa sur votre écran
        </p>
        <p className="invite-install-detail">
          {ios ? (
            <>
              Touchez <Share size={13} aria-label="Partager" style={{ verticalAlign: '-2px' }} /> puis
              « Sur l'écran d'accueil » <Plus size={13} style={{ verticalAlign: '-2px' }} />
            </>
          ) : (
            // Un argument vérifiable plutôt qu'une promesse : le client vient
            // de réserver, il sait ce qu'il y a à retrouver.
            'Vos réservations consultables sans connexion.'
          )}
        </p>
      </div>

      {!ios && (
        <button type="button" className="btn btn-primaire btn-sm invite-install-action" onClick={installer}>
          <Download size={15} aria-hidden="true" />
          Ajouter
        </button>
      )}

      <button type="button" className="invite-install-fermer" onClick={refuser} aria-label="Ne pas installer">
        <X size={18} aria-hidden="true" />
      </button>
    </aside>
  )
}
