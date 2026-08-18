import { useEffect, useState } from 'react'
import { Download, Share, Plus, X } from 'lucide-react'
import {
  demanderInstallation,
  estIOS,
  estInstallee,
  installationPossible,
  surChangementInstallation,
} from '../../lib/pwa'

const CLE_REFUS = 'installation-refusee-le'

/** Un refus vaut deux mois de silence. Redemander plus tôt est du harcèlement. */
const DELAI_APRES_REFUS = 60 * 24 * 3600 * 1000

/**
 * Un visiteur qui vient d'arriver n'a aucune raison d'installer quoi que ce
 * soit : il ne sait pas encore si le service lui convient. On attend qu'il ait
 * regardé quelques écrans.
 */
const PAGES_AVANT_PROPOSITION = 3
const CLE_PAGES = 'pages-vues'

function refusRecent(): boolean {
  try {
    const le = localStorage.getItem(CLE_REFUS)
    return le !== null && Date.now() - Number(le) < DELAI_APRES_REFUS
  } catch {
    return false
  }
}

/**
 * Mémorisé au niveau du module : en mode strict React monte le composant deux
 * fois, et sans cela une seule visite compterait pour deux pages.
 */
let pagesVues: number | null = null

function compterPage(): number {
  if (pagesVues !== null) return pagesVues

  try {
    pagesVues = Number(sessionStorage.getItem(CLE_PAGES) ?? '0') + 1
    sessionStorage.setItem(CLE_PAGES, String(pagesVues))
  } catch {
    // Navigation privée : on ne bloque pas la proposition pour autant.
    pagesVues = PAGES_AVANT_PROPOSITION
  }

  return pagesVues
}

/** Safari est le seul navigateur iOS où le geste « écran d'accueil » existe. */
function safariIOS(): boolean {
  return estIOS() && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent)
}

/**
 * Faut-il proposer l'installation dès le premier rendu ?
 *
 * Trois refus, et il faut les respecter tous les trois : déjà installée,
 * refusée récemment, ou visiteur qui vient d'arriver. Une bannière qui surgit
 * à la première seconde se fait refuser une fois pour toutes — et le navigateur
 * ne redonne jamais de seconde chance.
 */
function proposerDEntree(): boolean {
  if (estInstallee() || refusRecent()) return false
  if (compterPage() < PAGES_AVANT_PROPOSITION) return false

  return safariIOS() || installationPossible()
}

/**
 * Propose d'installer Ma Villa sur l'écran d'accueil.
 *
 * Trois raisons de ne rien afficher, et il faut les respecter toutes : déjà
 * installée, refusée récemment, ou visiteur qui vient d'arriver. Une bannière
 * d'installation qui surgit à la première seconde est le meilleur moyen de se
 * faire refuser une fois pour toutes — le navigateur ne repropose jamais.
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
      setVisible(dispo && !refusRecent() && compterPage() >= PAGES_AVANT_PROPOSITION)
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
    <div className="invite-install" role="dialog" aria-labelledby="invite-install-titre">
      <img src="/icon-192.png" alt="" width={44} height={44} className="invite-install-icone" />

      <div className="invite-install-texte">
        <p id="invite-install-titre" className="invite-install-titre">
          Installer Ma Villa
        </p>
        <p className="invite-install-detail">
          {ios ? (
            <>
              Touchez <Share size={13} aria-label="Partager" style={{ verticalAlign: '-2px' }} /> puis
              « Sur l'écran d'accueil » <Plus size={13} style={{ verticalAlign: '-2px' }} />
            </>
          ) : (
            'Accès direct depuis l\'écran d\'accueil, même hors ligne.'
          )}
        </p>
      </div>

      {!ios && (
        <button type="button" className="btn btn-primaire btn-sm invite-install-action" onClick={installer}>
          <Download size={15} aria-hidden="true" />
          Installer
        </button>
      )}

      <button type="button" className="invite-install-fermer" onClick={refuser} aria-label="Ne pas installer">
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  )
}
