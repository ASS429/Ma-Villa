import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../../services/api'
import { useConfig } from '../../context/ConfigContext'
import { useRequete } from '../../lib/useRequete'
import { messageErreur } from '../../lib/erreurs'
import { fcfa, dateCourte } from '../../lib/format'
import Button from '../../components/ui/Button'
import Seo from '../../components/Seo'
import type { Reservation } from '../../types'

const LOGOS: Record<string, string> = {
  wave: '/wave.webp',
  orange_money: '/orange-money.webp',
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
  const { paiement: config } = useConfig()

  const [methode, setMethode] = useState<string>('')
  const [telephone, setTelephone] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreurEnvoi, setErreurEnvoi] = useState('')
  const [attente, setAttente] = useState<{ reference: string; url: string } | null>(null)
  // La réservation n'est chargée qu'une fois : sans ce drapeau, un paiement
  // refusé laisserait l'écran d'attente tourner sur une donnée périmée.
  const [refuse, setRefuse] = useState(false)

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
    ? { reference: reservation.paiement.reference ?? '—', url: reservation.paiement.url_paiement ?? '' }
    : null)

  // Une fois le payeur parti sur Wave ou Orange Money, seule l'IPN nous dira
  // que c'est réglé : on interroge le serveur, on ne devine pas.
  useEffect(() => {
    if (!attente && !dejaLance) return

    const minuteur = setInterval(async () => {
      try {
        const { data } = await api.get(`/reservations/${id}/paiement`)
        if (data.statut === 'reussi') {
          clearInterval(minuteur)
          navigate(`/reservation/${id}/confirmee`, { replace: true })
        } else if (data.statut === 'echoue') {
          clearInterval(minuteur)
          setAttente(null)
          setRefuse(true)
          setErreurEnvoi('Le paiement n\'a pas abouti. Vous pouvez réessayer.')
        }
      } catch { /* réseau instable : on retentera au tour suivant */ }
    }, 4000)

    return () => clearInterval(minuteur)
  }, [attente, dejaLance, id, navigate])

  const lancer = async () => {
    setErreurEnvoi('')
    setEnvoi(true)
    try {
      const { data } = await api.post(`/reservations/${id}/paiement`, { methode, telephone })
      setAttente({ reference: data.reference, url: data.url })

      // L'application du payeur est plus directe qu'un QR code à scanner sur
      // l'écran qu'on tient déjà dans la main.
      const cible = data.url_application || data.url
      if (cible) window.open(cible, '_blank', 'noopener')
    } catch (err) {
      setErreurEnvoi(messageErreur(err, 'Le paiement n\'a pas pu être lancé.'))
    } finally {
      setEnvoi(false)
    }
  }

  if (chargement) {
    return <div className="tunnel"><p className="th-text-2 text-sm">Chargement…</p></div>
  }

  if (erreur || !reservation) {
    return (
      <div className="tunnel">
        <p className="th-text-1 font-medium mb-2">Réservation introuvable</p>
        <p className="th-text-2 text-sm mb-6">{erreur}</p>
        <Button variante="secondaire" taille="sm" onClick={() => navigate('/dashboard/reservations')}>
          Mes réservations
        </Button>
      </div>
    )
  }

  // Déjà réglée : le serveur répondrait 409 au moment de payer. Autant montrer
  // tout de suite la confirmation plutôt qu'un formulaire condamné.
  if (reservation.paiement?.statut === 'reussi') {
    return (
      <div className="tunnel">
        <p className="th-text-1 font-medium mb-2">Cette réservation est déjà réglée</p>
        <p className="th-text-2 text-sm mb-6">
          Référence {reservation.paiement.reference ?? '—'}.
        </p>
        <Button variante="secondaire" taille="sm" onClick={() => navigate(`/reservation/${id}/confirmee`)}>
          Voir la confirmation
        </Button>
      </div>
    )
  }

  if (!config.actif) {
    return (
      <div className="tunnel">
        <p className="th-text-1 font-medium mb-2">Paiement en ligne pas encore ouvert</p>
        <p className="th-text-2 text-sm mb-6">
          Le règlement se fait directement avec le propriétaire, qui vous contactera.
        </p>
        <Button variante="secondaire" taille="sm" onClick={() => navigate('/dashboard/reservations')}>
          Mes réservations
        </Button>
      </div>
    )
  }

  return (
    <div className="tunnel">
      <Seo titre="Paiement" description="Réglez votre réservation." indexable={false} />

      <header className="tunnel-entete">
        <Link to="/dashboard/reservations" className="tunnel-retour" aria-label="Retour">‹</Link>
        <span className="tunnel-titre">Votre réservation</span>
        <span className="tunnel-etape">{enCours ? '2 / 2' : '1 / 2'}</span>
      </header>

      {enCours ? (
        <section className="tunnel-corps">
          <h1 className="tunnel-h1">Confirmez sur votre téléphone</h1>
          <p className="th-text-2 text-sm mb-6">
            Validez le paiement dans votre application. Cet écran se met à jour tout seul —
            ne le fermez pas.
          </p>

          <div className="tunnel-attente" role="status" aria-live="polite">
            <span className="tunnel-pulsation" aria-hidden="true" />
            <span className="th-text-2 text-sm">En attente de votre confirmation…</span>
          </div>

          <dl className="tunnel-recap">
            <div><dt>Référence</dt><dd>{enCours.reference}</dd></div>
            <div><dt>Montant</dt><dd>{fcfa(reservation.montant_total)}</dd></div>
          </dl>

          {enCours.url && (
            <p className="text-xs th-text-3 mt-6">
              L'application ne s'est pas ouverte ?{' '}
              <a href={enCours.url} target="_blank" rel="noopener noreferrer" className="th-text-1 underline">
                Rouvrir la page de paiement
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
                <span>{m.nom}</span>
              </button>
            ))}
          </div>

          {methode && (
            <label className="tunnel-champ">
              <span className="champ-label">Numéro {config.moyens.find((m) => m.cle === methode)?.nom}</span>
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
            <p className="tunnel-erreur" role="alert">{erreurEnvoi}</p>
          )}

          <Button
            variante="primaire"
            taille="lg"
            className="w-full mt-6"
            disabled={!methode || telephone.replace(/\D/g, '').length < 9 || envoi}
            onClick={lancer}
          >
            {envoi ? 'Ouverture…' : `Payer ${fcfa(reservation.montant_total)}`}
          </Button>

          <p className="text-xs th-text-3 mt-4 text-center">
            Vous serez redirigé vers votre application pour confirmer.
          </p>
        </section>
      )}
    </div>
  )
}
