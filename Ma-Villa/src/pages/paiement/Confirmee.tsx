import { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { MapPin, Phone, CalendarPlus, MessageSquare, ChevronRight, WifiOff } from 'lucide-react'
import api from '../../services/api'
import { useRequete } from '../../lib/useRequete'
import { fcfa, periode } from '../../lib/format'
import { telechargerIcal } from '../../lib/calendrier'
import Seo from '../../components/Seo'
import type { Reservation } from '../../types'
import Marque from '../../components/Marque'
import { marquerPremiereReservation } from '../../lib/installation'

const MOYENS: Record<string, string> = {
  wave: 'Wave',
  orange_money: 'Orange Money',
}

/* ── Une chose à faire ───────────────────────────────────────── */

interface ProprietesAction {
  Icone: typeof MapPin
  titre: string
  detail: string
  /** Une seule action porte l'accent sur cet écran : appeler. */
  accent?: boolean
  href?: string
  to?: string
  onClick?: () => void
}

function Action({ Icone, titre, detail, accent, href, to, onClick }: ProprietesAction) {
  const contenu = (
    <>
      <span className="apres-icone" aria-hidden="true"><Icone size={17} /></span>
      <span className="apres-texte">
        <span className="apres-titre">{titre}</span>
        <span className="apres-detail">{detail}</span>
      </span>
      <ChevronRight className="apres-fleche" size={16} aria-hidden="true" />
    </>
  )

  const classe = `apres${accent ? ' est-accent' : ''}`

  if (href) return <a className={classe} href={href}>{contenu}</a>
  if (to) return <Link className={classe} to={to}>{contenu}</Link>
  return <button type="button" className={classe} onClick={onClick}>{contenu}</button>
}

/* ── L'écran ─────────────────────────────────────────────────── */

/**
 * « C'est réservé » — le dernier écran du tunnel, et il a changé de nature.
 *
 * C'était un écran de félicitations avec une référence. Or c'est **le seul
 * moment où le client a une décharge d'attention et quatre choses à faire** :
 * noter l'adresse, appeler le propriétaire, bloquer la date, prévenir d'une
 * arrivée tardive. Dire « merci » puis renvoyer à l'accueil gaspille
 * exactement cette fenêtre.
 *
 * Trois règles portent le reste :
 *
 *   — **le numéro du propriétaire apparaît ici, pour la première fois.**
 *     C'est la contrepartie visible de sa disparition des fiches : le client
 *     comprend qu'il ne l'a pas perdu, il l'a gagné en réservant. Sans ce
 *     moment, le masquage se lit comme une rétention ;
 *   — **une seule action en accent** — appeler. Les trois autres sont des
 *     lignes de même poids ;
 *   — **la phrase sur le hors ligne empêche la capture d'écran.** Un client
 *     qui photographie sa confirmation le fait parce qu'il ne croit pas la
 *     retrouver. Le lui dire coûte une ligne.
 */
export default function Confirmee() {
  const { id } = useParams()

  const { donnees: reservation } = useRequete<Reservation>(
    async (signal) => (await api.get(`/reservations/${id}`, { signal })).data,
    `reservation-${id}`
  )

  // C'est ici, et nulle part ailleurs, que l'invitation à garder PasseTemps sur
  // l'écran d'accueil devient légitime : le client a maintenant quelque chose
  // à retrouver. Elle n'apparaît pas sur cet écran — il reste nu — mais à
  // partir d'ici, sur les écrans qui l'accueillent.
  useEffect(() => { marquerPremiereReservation() }, [])

  const villa = reservation?.logement.villa
  const paiement = reservation?.paiement
  const moyen = paiement?.methode ? MOYENS[paiement.methode] ?? paiement.methode : null

  // L'adresse saisie par le propriétaire porte souvent déjà la ville
  // (« Cité Balnéaire, Mbour ») : la recoller produisait « Mbour, Mbour ».
  const adresse = (() => {
    const rue = villa?.adresse?.trim()
    const ville = villa?.ville?.trim()
    if (!rue) return ville ?? ''
    if (!ville) return rue
    return rue.toLowerCase().includes(ville.toLowerCase()) ? rue : `${rue}, ${ville}`
  })()
  const carte = villa?.latitude && villa?.longitude
    ? `https://www.google.com/maps/search/?api=1&query=${villa.latitude},${villa.longitude}`
    : adresse
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`
      : null

  function bloquerLaDate() {
    if (!reservation || !villa) return

    telechargerIcal({
      titre: `Séjour — ${villa.nom}`,
      lieu: adresse || villa.ville || '',
      debut: reservation.date_debut,
      fin: reservation.date_fin,
      note: `Réservation PasseTemps n° ${reservation.id}${villa.telephone ? ` · propriétaire ${villa.telephone}` : ''}`,
    }, `sejour-${reservation.id}.ics`)
  }

  return (
    <div className="tunnel">
      <Seo titre="Réservation confirmée" description="Votre réservation est confirmée." indexable={false} />

      <div className="tunnel-marque">
        <Marque taille="sm" />
      </div>

      <section className="tunnel-corps tunnel-succes">
        <div className="succes-marque" aria-hidden="true">
          <svg viewBox="0 0 52 52" width="72" height="72">
            <circle className="succes-cercle" cx="26" cy="26" r="24" fill="none" strokeWidth="2" />
            <path className="succes-coche" fill="none" strokeWidth="3" strokeLinecap="round"
                  strokeLinejoin="round" d="M14 27l8 8 16-16" />
          </svg>
        </div>

        <h1 className="tunnel-h1 text-center">C'est réservé</h1>

        {reservation && (
          <>
            <p className="confirmee-sejour">
              {reservation.logement.villa.nom} · {periode(reservation.date_debut, reservation.date_fin)}
              {' · '}{reservation.nb_personnes} personne{reservation.nb_personnes > 1 ? 's' : ''}
            </p>

            <p className="confirmee-montant">
              <strong>{fcfa(reservation.montant_total)}</strong>
              <span>payés{moyen ? ` · ${moyen}` : ''}</span>
            </p>

            {paiement?.reference && (
              <p className="confirmee-reference">réf. {paiement.reference}</p>
            )}
          </>
        )}

        {reservation && (
          <div className="apres-bloc">
            <h2 className="apres-titre-section">Ce qu'il vous reste à faire</h2>

            {/* L'ordre suit celui de l'arrivée : où aller, qui prévenir,
                quand, et comment signaler un imprévu. */}
            {carte && (
              <Action
                Icone={MapPin}
                titre="Noter l'adresse"
                detail={adresse || villa?.ville || 'Ouvrir dans le plan'}
                href={carte}
              />
            )}

            {/* Le numéro apparaît ici pour la première fois. S'il manque, la
                ligne disparaît plutôt que d'afficher un bouton mort. */}
            {villa?.telephone && (
              <Action
                Icone={Phone}
                titre="Appeler le propriétaire"
                detail={villa.telephone}
                href={`tel:${villa.telephone.replace(/\s/g, '')}`}
                accent
              />
            )}

            <Action
              Icone={CalendarPlus}
              titre="Bloquer la date"
              detail="Ajouter le séjour à votre agenda"
              onClick={bloquerLaDate}
            />

            <Action
              Icone={MessageSquare}
              titre="Prévenir d'une arrivée tardive"
              detail="Écrire au propriétaire, il garde la trace"
              to={`/dashboard/reservations/${reservation.id}/messages`}
            />

            {/* Un client qui photographie sa confirmation le fait parce qu'il
                ne croit pas la retrouver. */}
            <p className="apres-note">
              <WifiOff size={14} aria-hidden="true" />
              <span>
                Ce récapitulatif reste consultable sans connexion, dans{' '}
                <Link to="/dashboard/reservations">Réservations</Link>. Vous n'avez
                pas besoin de le noter.
              </span>
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
