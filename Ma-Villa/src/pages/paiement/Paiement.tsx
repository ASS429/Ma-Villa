import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { CreditCard } from 'lucide-react'
import api from '../../services/api'
import { useConfig } from '../../context/ConfigContext'
import ContactReservation from '../../components/ContactReservation'
import { modeReservation } from '../../lib/ouverture'
import { useRequete } from '../../lib/useRequete'
import { messageErreur } from '../../lib/erreurs'
import { fcfa, dateCourte } from '../../lib/format'
import Button from '../../components/ui/Button'
import CodeQR from '../../components/paiement/CodeQR'
import { surAppareilMobile } from '../../lib/appareil'
import { chiffresDuNumero } from '../../lib/telephone'
import Seo from '../../components/Seo'
import type { Reservation } from '../../types'
import Marque from '../../components/Marque'

const LOGOS: Record<string, string> = {
  wave: '/wave.webp',
  orange_money: '/orange-money.webp',
}

/** Au-delà, on cesse d'interroger et on rend la main : chaque vérification est
 *  un appel sortant vers le prestataire, et le serveur est mono-processus. */
const DUREE_SUIVI = 90_000


/**
 * Cause technique que le serveur joint au refus hors encaissement réel — le
 * message du prestataire, code compris. En production sur clés réelles, le
 * champ est absent et rien ne s'affiche.
 */
function raisonTechnique(err: unknown): string {
  const donnees = (err as { response?: { data?: { raison?: unknown } } })?.response?.data
  return typeof donnees?.raison === 'string' ? donnees.raison : ''
}

/**
 * Les écrans d'état du tunnel (chargement, fermé, déjà réglé…) gardent la
 * marque et la colonne du formulaire. Sans elles, le texte se collait au coin
 * de l'écran et le bouton s'étirait sur toute la largeur.
 */
function EcranEtat({ children }: { children: React.ReactNode }) {
  return (
    <div className="tunnel">
      <Seo titre="Paiement" description="Réglez votre réservation." indexable={false} />
      <div className="tunnel-marque">
        <Marque taille="sm" />
      </div>
      <section className="tunnel-corps">{children}</section>
    </div>
  )
}

/**
 * Tunnel de paiement — planche 12.
 *
 * Aucune animation décorative ici : chaque milliseconde ajoutée entre un
 * montant et sa validation est un abandon. C'est un écran où l'utilisateur
 * travaille, et le mouvement y est du bruit.
 *
 * Le montant affiché est celui de l'annonce, ni plus ni moins : la commission
 * est prélevée sur ce que paie le client, jamais ajoutée par-dessus. Un prix
 * qui gonfle au récapitulatif est exactement ce qui fait abandonner.
 */
export default function Paiement() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { paiement: config, reservations } = useConfig()

  const [methode, setMethode] = useState<string>('')
  const [telephone, setTelephone] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreurEnvoi, setErreurEnvoi] = useState('')
  // Cause technique renvoyée par le serveur hors encaissement réel. Elle est
  // affichée à part : « clé maîtresse refusée » n'a rien à dire à un client,
  // et tout à dire à qui teste l'intégration.
  const [raison, setRaison] = useState('')
  // Ce que PayDunya répond, mot pour mot, hors encaissement réel. « Rien ne se
  // passe » est indéchiffrable ; « PayDunya répond pending » dit où regarder.
  const [cotePrestataire, setCotePrestataire] = useState('')
  // `url` est ce qu'on encode dans le code QR (une page atteignable depuis
  // n'importe quel appareil), `lien` ce qu'on ouvre sur téléphone.
  const [attente, setAttente] = useState<
    {
      reference: string
      url: string
      lien: string
      repli?: boolean
      /** Autre application du payeur, proposée en second si elle diffère. */
      secours?: string
      /** Page à QR code du prestataire, dernier recours. */
      page?: string
    } | null
  >(null)
  // La réservation n'est chargée qu'une fois : sans ce drapeau, un paiement
  // refusé laisserait l'écran d'attente tourner sur une donnée périmée.
  const [refuse, setRefuse] = useState(false)
  // Le suivi automatique s'arrête au bout de DUREE_SUIVI et rend la main.
  const [suiviEpuise, setSuiviEpuise] = useState(false)
  const [verification, setVerification] = useState(false)
  const dejaRedirige = useRef(false)

  const { donnees: reservation, chargement, erreur } = useRequete<Reservation>(
    async (signal) => (await api.get(`/reservations/${id}`, { signal })).data,
    `reservation-${id}`,
    { messageErreurParDefaut: 'Réservation introuvable.' }
  )

  // Wave et Orange Money ramènent le payeur sur cette page une fois son code
  // saisi. Il doit y retrouver son suivi, pas le formulaire qu'il vient de
  // remplir : rien ne serait plus inquiétant que de revoir « Payer » après
  // avoir payé.
  const dejaLance = !refuse && reservation?.paiement?.statut === 'en_attente'
  const enCours = attente ?? (dejaLance && reservation?.paiement
    ? {
        reference: reservation.paiement.reference ?? '—',
        url: reservation.paiement.url_paiement ?? reservation.paiement.url_application ?? '',
        lien: reservation.paiement.url_application ?? reservation.paiement.url_paiement ?? '',
      }
    : null)

  const suivi = (attente !== null || dejaLance) && !suiviEpuise
  const mobile = surAppareilMobile()

  // Nommer l'application plutôt que dire « votre application » : le payeur sait
  // alors quoi chercher sur son écran d'accueil. Au rechargement, le moyen vient
  // du paiement enregistré, pas du formulaire qu'on n'a plus.
  const cleMoyen = methode || reservation?.paiement?.methode || ''
  const nomMoyen = config.moyens.find((m) => m.cle === cleMoyen)?.nom ?? 'votre application'

  /** Une vérification, partagée par le suivi automatique et le bouton manuel. */
  const verifierUneFois = async () => {
    const { data } = await api.get(`/reservations/${id}/paiement`)
    setCotePrestataire(typeof data.prestataire === 'string' ? data.prestataire : '')

    if (data.statut === 'reussi') {
      navigate(`/reservation/${id}/confirmee`, { replace: true })
      return true
    }

    if (data.statut === 'echoue') {
      setAttente(null)
      setRefuse(true)
      setSuiviEpuise(false)
      setErreurEnvoi('Le paiement n\'a pas abouti. Vous pouvez réessayer.')
      return true
    }

    return false
  }

  // Sur téléphone, le lien renvoyé ouvre directement Wave ou Orange Money.
  //
  // Ce n'était pas fait par `window.open()` : appelé après un `await`, il sort
  // du geste de l'utilisateur et les navigateurs le bloquent. Rien ne s'ouvrait,
  // et l'écran d'attente tournait devant une application jamais lancée. Une
  // navigation, elle, n'est jamais bloquée.
  useEffect(() => {
    if (!mobile || dejaRedirige.current || !attente?.lien) return

    dejaRedirige.current = true
    const minuteur = setTimeout(() => { window.location.href = attente.lien }, 1200)

    return () => clearTimeout(minuteur)
  }, [mobile, attente])

  // Le prestataire ne prévient pas toujours : on lui redemande l'issue.
  useEffect(() => {
    if (!suivi) return

    const minuteur = setInterval(() => {
      verifierUneFois().then((fini) => { if (fini) clearInterval(minuteur) })
        .catch(() => { /* réseau instable : on retentera au tour suivant */ })
    }, 4000)

    // Interroger indéfiniment coûterait un appel sortant toutes les quatre
    // secondes, sur un serveur mono-processus, pour un paiement peut-être
    // abandonné. Passé ce délai, on rend la main plutôt que de faire tourner
    // une roue devant quelqu'un qui n'attend plus.
    const fin = setTimeout(() => setSuiviEpuise(true), DUREE_SUIVI)

    return () => { clearInterval(minuteur); clearTimeout(fin) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- verifierUneFois est recréée à chaque rendu
  }, [suivi, id, navigate])

  const verifierMaintenant = async () => {
    setVerification(true)
    try {
      const fini = await verifierUneFois()
      if (!fini) setSuiviEpuise(true)
    } catch {
      setSuiviEpuise(true)
    } finally {
      setVerification(false)
    }
  }

  const lancer = async () => {
    setErreurEnvoi('')
    setRaison('')
    setEnvoi(true)
    try {
      const { data } = await api.post(`/reservations/${id}/paiement`, { methode, telephone })

      // La carte se saisit sur la page de PayDunya, sur ordinateur comme sur
      // téléphone : y aller tout de suite. Elle ramène ici, où le suivi
      // reprend le paiement en cours. Ni code QR ni application à ouvrir.
      if (methode === 'carte' && data.url) {
        window.location.href = data.url
        return
      }

      setSuiviEpuise(false)
      dejaRedirige.current = false
      const principal: string = data.url_application || data.url || ''
      setAttente({
        reference: data.reference,
        url: data.url || data.url_application || '',
        lien: principal,
        repli: Boolean(data.repli),
        secours: [data.url_maxit, data.url_om].find(
          (u: string | null) => typeof u === 'string' && u && u !== principal
        ) ?? undefined,
        page: data.url_page ?? undefined,
      })
    } catch (err) {
      setErreurEnvoi(messageErreur(err, 'Le paiement n\'a pas pu être lancé.'))
      setRaison(raisonTechnique(err))
    } finally {
      setEnvoi(false)
    }
  }

  if (chargement) {
    return <EcranEtat><p className="th-text-2 text-sm">Chargement…</p></EcranEtat>
  }

  if (erreur || !reservation) {
    return (
      <EcranEtat>
        <p className="th-text-1 font-medium mb-2">Réservation introuvable</p>
        <p className="th-text-2 text-sm mb-6">{erreur}</p>
        <Button variante="secondaire" taille="sm" onClick={() => navigate('/dashboard/reservations')}>
          Mes réservations
        </Button>
      </EcranEtat>
    )
  }

  // Déjà réglée : le serveur répondrait 409 au moment de payer. Autant montrer
  // tout de suite la confirmation plutôt qu'un formulaire condamné.
  if (reservation.paiement?.statut === 'reussi') {
    return (
      <EcranEtat>
        <p className="th-text-1 font-medium mb-2">Cette réservation est déjà réglée</p>
        <p className="th-text-2 text-sm mb-6">
          Référence {reservation.paiement.reference ?? '—'}.
        </p>
        <Button variante="secondaire" taille="sm" onClick={() => navigate(`/reservation/${id}/confirmee`)}>
          Voir la confirmation
        </Button>
      </EcranEtat>
    )
  }

  // Suspendue, la réservation l'est jusqu'au règlement : le serveur refuserait
  // de lancer le paiement. Un paiement **déjà lancé** reste en revanche
  // vérifiable — l'écran ne doit pas cacher un débit qui attend sa confirmation.
  // Une annonce des associés se règle, elle, auprès de l'équipe.
  const mode = modeReservation(reservations, reservation.logement.villa)
  if (mode !== 'en_ligne' && reservation.paiement?.statut !== 'en_attente') {
    return (
      <EcranEtat>
        <div className="mb-6">
          <ContactReservation hebergement={reservation.logement.villa.nom} equipe={mode === 'equipe'} />
        </div>
        <Button variante="secondaire" taille="sm" onClick={() => navigate('/dashboard/reservations')}>
          Mes réservations
        </Button>
      </EcranEtat>
    )
  }

  if (!config.actif) {
    return (
      <EcranEtat>
        <p className="th-text-1 font-medium mb-2">Paiement en ligne pas encore ouvert</p>
        <p className="th-text-2 text-sm mb-6">
          {reservation.logement.villa.encaisse_par_la_plateforme
            ? 'Le règlement se fait auprès de PasseTemps, qui vous contactera.'
            : 'Le règlement se fait directement avec le propriétaire, qui vous contactera.'}
        </p>
        <Button variante="secondaire" taille="sm" onClick={() => navigate('/dashboard/reservations')}>
          Mes réservations
        </Button>
      </EcranEtat>
    )
  }

  return (
    <div className="tunnel">
      <Seo titre="Paiement" description="Réglez votre réservation." indexable={false} />

      <div className="tunnel-marque">
        <Marque taille="sm" />
      </div>

      <header className="tunnel-entete">
        <Link to="/dashboard/reservations" className="tunnel-retour" aria-label="Retour">‹</Link>
        <span className="tunnel-titre">Votre réservation</span>
        <span className="tunnel-etape">{enCours ? '2 / 2' : '1 / 2'}</span>
      </header>

      {enCours ? (
        <section className="tunnel-corps">
          {/* Ne jamais annoncer un code qu'on n'a pas : si le prestataire n'a
              renvoyé aucun lien, l'écran doit le dire au lieu de faire attendre
              devant une consigne impossible à suivre. */}
          <h1 className="tunnel-h1">
            {cleMoyen === 'carte'
              ? 'Paiement par carte en cours'
              : !enCours.url && !enCours.lien
                ? 'Paiement lancé'
                : mobile ? 'Confirmez sur votre téléphone' : 'Scannez pour payer'}
          </h1>
          <p className="th-text-2 text-sm mb-6">
            {/* Le repli passe par la page du prestataire : annoncer l'étape de
                plus plutôt que de laisser découvrir un écran inattendu. */}
            {cleMoyen === 'carte'
              ? `Réglez ${fcfa(reservation.montant_total)} sur la page sécurisée de PayDunya. Cet écran se met à jour tout seul dès que le paiement est reçu.`
              : enCours.repli
              ? `Une page de paiement sécurisée va s'ouvrir : choisissez-y ${nomMoyen} pour régler ${fcfa(reservation.montant_total)}. Cet écran se met à jour tout seul.`
              : !enCours.url && !enCours.lien
                ? `Ouvrez ${nomMoyen} sur votre téléphone : la demande de ${fcfa(reservation.montant_total)} vous y attend. Cet écran se met à jour tout seul.`
                : mobile
                  ? `${nomMoyen} va s'ouvrir pour valider ${fcfa(reservation.montant_total)}. Cet écran se met à jour tout seul.`
                  : `Ouvrez ${nomMoyen} sur votre téléphone et scannez ce code. Cet écran se met à jour tout seul.`}
          </p>

          {/* Sur ordinateur, le lien du prestataire ne mène nulle part : c'est
              le téléphone qui paie. Le code QR est le seul pont entre les deux. */}
          {/* La carte se paie sur la page de PayDunya, depuis cet appareil :
              un code QR n'aurait aucun sens. */}
          {cleMoyen === 'carte' && enCours.url && (
            <a href={enCours.url} className="btn btn-primaire btn-md w-full justify-center mb-4">
              Rouvrir la page de paiement
            </a>
          )}

          {cleMoyen !== 'carte' && !mobile && enCours.url && (
            <div className="tunnel-qr">
              <CodeQR valeur={enCours.url} taille={200} />
            </div>
          )}

          {cleMoyen !== 'carte' && mobile && enCours.lien && (
            <a href={enCours.lien} className="btn btn-primaire btn-md w-full justify-center mb-4">
              {enCours.repli ? 'Ouvrir la page de paiement' : `Ouvrir ${nomMoyen}`}
            </a>
          )}

          {/* L'autre application du même opérateur : le payeur a peut-être
              Maxit sans Orange Money, ou l'inverse. */}
          {mobile && enCours.secours && (
            <a href={enCours.secours} className="btn btn-secondaire btn-md w-full justify-center mb-4">
              Essayer avec l'autre application
            </a>
          )}

          {suiviEpuise ? (
            <div className="tunnel-attente" role="status">
              <span className="th-text-2 text-sm">
                Toujours rien reçu. Validez le paiement, puis vérifiez.
                {cotePrestataire && (
                  <span className="tunnel-attente-detail">PayDunya répond « {cotePrestataire} »</span>
                )}
              </span>
            </div>
          ) : (
            <div className="tunnel-attente" role="status" aria-live="polite">
              <span className="tunnel-pulsation" aria-hidden="true" />
              <span className="th-text-2 text-sm">
                En attente de votre confirmation…
                {cotePrestataire && (
                  <span className="tunnel-attente-detail">PayDunya répond « {cotePrestataire} »</span>
                )}
              </span>
            </div>
          )}

          {suiviEpuise && (
            <Button
              variante="secondaire"
              taille="md"
              className="w-full mt-4"
              disabled={verification}
              onClick={verifierMaintenant}
            >
              {verification ? 'Vérification…' : 'Vérifier maintenant'}
            </Button>
          )}

          <dl className="tunnel-recap">
            <div><dt>Référence</dt><dd>{enCours.reference}</dd></div>
            <div><dt>Montant</dt><dd>{fcfa(reservation.montant_total)}</dd></div>
          </dl>

          {(enCours.url || enCours.lien) && (
            <p className="text-xs th-text-3 mt-6">
              {mobile ? "L'application ne s'est pas ouverte ? " : 'Impossible de scanner ? '}
              <a
                href={enCours.page ?? (mobile ? enCours.lien || enCours.url : enCours.url || enCours.lien)}
                target="_blank"
                rel="noopener noreferrer"
                className="th-text-1 underline"
              >
                Ouvrir la page de paiement
              </a>
            </p>
          )}
        </section>
      ) : (
        <section className="tunnel-corps">
          <h1 className="tunnel-h1">Récapitulatif</h1>

          <div className="tunnel-bien">
            <p className="font-medium th-text-1">{reservation.logement.villa.nom}</p>
            <p className="text-sm th-text-2">{reservation.logement.nom}</p>
            <p className="text-sm th-text-3">
              Du {dateCourte(reservation.date_debut)} au {dateCourte(reservation.date_fin)} ·{' '}
              {reservation.nb_personnes} pers.
            </p>
          </div>

          {/* Un seul montant, du premier écran au débit. */}
          <div className="tunnel-total">
            <span className="th-text-2 text-sm">Total à payer</span>
            <span className="tunnel-montant">{fcfa(reservation.montant_total)}</span>
          </div>

          <h2 className="tunnel-h2">Comment souhaitez-vous payer ?</h2>
          <div className="tunnel-moyens">
            {config.moyens.map((m) => (
              <button
                key={m.cle}
                type="button"
                className={`tunnel-moyen${methode === m.cle ? ' est-choisi' : ''}`}
                onClick={() => setMethode(m.cle)}
                aria-pressed={methode === m.cle}
              >
                {LOGOS[m.cle] && <img src={LOGOS[m.cle]} alt="" aria-hidden="true" width={36} height={36} />}
                {m.cle === 'carte' && <CreditCard size={30} strokeWidth={1.6} aria-hidden="true" />}
                <span>{m.nom}</span>
              </button>
            ))}
          </div>

          {methode && (
            <label className="tunnel-champ">
              {/* Le numéro reste demandé pour la carte : c'est par lui qu'un
                  remboursement vous parviendrait, sur Wave ou Orange Money. */}
              <span className="champ-label">
                {methode === 'carte'
                  ? 'Votre numéro, pour un éventuel remboursement'
                  : `Numéro ${config.moyens.find((m) => m.cle === methode)?.nom}`}
              </span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className="champ-controle"
                placeholder="77 123 45 67"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
              />
            </label>
          )}

          {erreurEnvoi && (
            <p className="tunnel-erreur" role="alert">
              {erreurEnvoi}
              {raison && (
                <span className="tunnel-erreur-detail">{raison}</span>
              )}
            </p>
          )}

          <Button
            variante="primaire"
            taille="lg"
            className="w-full mt-6"
            disabled={!methode || chiffresDuNumero(telephone).length < 9 || envoi}
            onClick={lancer}
          >
            {envoi ? 'Ouverture…' : `Payer ${fcfa(reservation.montant_total)}`}
          </Button>

          <p className="text-xs th-text-3 mt-4 text-center">
            {methode === 'carte'
              ? 'Vous saisirez votre carte sur la page sécurisée de PayDunya. Nous ne voyons jamais son numéro.'
              : 'Vous serez redirigé vers votre application pour confirmer.'}
          </p>
        </section>
      )}
    </div>
  )
}
