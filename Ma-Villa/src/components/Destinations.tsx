import { Link } from 'react-router-dom'
import api from '../services/api'
import { useRequete } from '../lib/useRequete'
import { fcfa } from '../lib/format'
import ScrollReveal from './ScrollReveal'

interface Destination {
  ville: string
  nb: number
  prix_min: number | string | null
  photo: string | null
}

/**
 * Accès par destination — planche 03.
 *
 * Les villes viennent de l'API, pas d'une liste écrite en dur : annoncer
 * « Ziguinchor » alors qu'aucune villa n'y est publiée mènerait le visiteur
 * vers une page vide dès son premier clic.
 */
export default function Destinations() {
  const { donnees, chargement } = useRequete<Destination[]>(
    async (signal) => (await api.get('/destinations', { signal })).data,
    'destinations'
  )

  const destinations = donnees ?? []

  if (!chargement && destinations.length === 0) return null

  return (
    <section className="px-6 md:px-12 lg:px-16 py-20" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-6xl mx-auto">
        <ScrollReveal className="mb-10">
          <p
            className="mb-2"
            style={{ font: 'var(--t-eyebrow)', letterSpacing: 'var(--t-eyebrow-ls)', textTransform: 'uppercase', color: 'var(--accent)' }}
          >
            Destinations
          </p>
          <h2 className="th-text-1" style={{ font: 'var(--t-h2)', letterSpacing: 'var(--t-h2-ls)' }}>
            Où allez-vous ?
          </h2>
        </ScrollReveal>

        {chargement ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="skeleton rounded-2xl" style={{ aspectRatio: '3/4' }} />
            ))}
          </div>
        ) : (
          <ScrollReveal className="sr-stagger grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {destinations.map((d) => (
              <Link
                key={d.ville}
                to={`/villas?ville=${encodeURIComponent(d.ville)}`}
                className="destination"
                aria-label={`${d.ville}, ${d.nb} villa${d.nb > 1 ? 's' : ''}`}
              >
                {d.photo ? (
                  <img src={d.photo} alt="" aria-hidden="true" loading="lazy" decoding="async" />
                ) : (
                  <div className="destination-sans-photo" aria-hidden="true" />
                )}
                <div className="destination-voile" aria-hidden="true" />
                <div className="destination-texte">
                  <p className="destination-ville">{d.ville}</p>
                  <p className="destination-detail">
                    {d.nb} villa{d.nb > 1 ? 's' : ''}
                    {d.prix_min != null && <> · dès {fcfa(d.prix_min)}</>}
                  </p>
                </div>
              </Link>
            ))}
          </ScrollReveal>
        )}
      </div>
    </section>
  )
}
