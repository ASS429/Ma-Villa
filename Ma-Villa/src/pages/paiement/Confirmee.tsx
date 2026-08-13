import { useParams, Link } from 'react-router-dom'
import api from '../../services/api'
import { useRequete } from '../../lib/useRequete'
import { fcfa, dateCourte } from '../../lib/format'
import Seo from '../../components/Seo'
import type { Reservation } from '../../types'

/**
 * « C'est réservé » — planche 12, écran de succès.
 *
 * La seule exception à la règle « aucun mouvement dans le tunnel » : il n'y a
 * plus rien à faire ici qu'à être content. Le seul moment célébré du produit,
 * et il dure 900 ms — au-delà, on retient l'utilisateur pour rien.
 */
export default function Confirmee() {
  const { id } = useParams()

  const { donnees: reservation } = useRequete<Reservation>(
    async (signal) => (await api.get(`/reservations/${id}`, { signal })).data,
    `reservation-${id}`
  )

  return (
    <div className="tunnel">
      <Seo titre="Réservation confirmée" description="Votre réservation est confirmée." indexable={false} />

      <section className="tunnel-corps tunnel-succes">
        <div className="succes-marque" aria-hidden="true">
          <svg viewBox="0 0 52 52" width="72" height="72">
            <circle className="succes-cercle" cx="26" cy="26" r="24" fill="none" strokeWidth="2" />
            <path className="succes-coche" fill="none" strokeWidth="3" strokeLinecap="round"
                  strokeLinejoin="round" d="M14 27l8 8 16-16" />
          </svg>
        </div>

        <h1 className="tunnel-h1 text-center">C'est réservé</h1>
        <p className="th-text-2 text-sm text-center mb-8">
          Votre paiement est confirmé. Le propriétaire a été prévenu et vous recevez
          ses coordonnées par email.
        </p>

        {reservation && (
          <dl className="tunnel-recap">
            <div>
              <dt>Logement</dt>
              <dd>{reservation.logement.villa.nom}</dd>
            </div>
            <div>
              <dt>Dates</dt>
              <dd>{dateCourte(reservation.date_debut)} → {dateCourte(reservation.date_fin)}</dd>
            </div>
            <div>
              <dt>Montant réglé</dt>
              <dd>{fcfa(reservation.montant_total)}</dd>
            </div>
          </dl>
        )}

        <div className="flex flex-col gap-3 mt-8">
          <Link to="/dashboard/reservations" className="btn btn-primaire btn-lg w-full justify-center">
            Voir ma réservation
          </Link>
          <Link to="/villas" className="btn btn-discret btn-md w-full justify-center">
            Continuer à explorer
          </Link>
        </div>
      </section>
    </div>
  )
}
