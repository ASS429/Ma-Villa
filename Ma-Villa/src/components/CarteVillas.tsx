import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { VillaResume } from '../types'
import { fcfaCourt } from '../lib/format'

/**
 * Carte des résultats de recherche — planche 05.
 *
 * Elle n'est pas décorative : à Saly, « à 300 m de la plage » et « à 3 km »
 * sont deux produits différents au même prix. Sans carte, le client ne peut
 * pas faire cette distinction.
 *
 * Le marqueur porte le prix plutôt qu'une épingle : sur une carte de
 * résultats, on compare des montants situés, pas des points.
 *
 * Leaflet est manipulé directement plutôt que via react-leaflet : la carte a
 * besoin d'être pilotée impérativement (recadrage sur les résultats,
 * remplacement des marqueurs à chaque recherche), et l'enrobage React
 * n'apporterait ici qu'une couche de plus.
 */
export default function CarteVillas({
  villas,
  villaSurvolee,
}: {
  villas: VillaResume[]
  villaSurvolee?: number | null
}) {
  const conteneur = useRef<HTMLDivElement>(null)
  const carte = useRef<L.Map | null>(null)
  const couche = useRef<L.LayerGroup | null>(null)
  const navigate = useNavigate()

  // Seules les villas géolocalisées peuvent être placées.
  const situees = useMemo(
    () => villas.filter((v) => v.latitude != null && v.longitude != null),
    [villas]
  )

  useEffect(() => {
    if (!conteneur.current || carte.current) return

    carte.current = L.map(conteneur.current, {
      // Le défilement de la page ne doit pas être capturé par la carte :
      // sur mobile, on se retrouverait piégé dedans.
      scrollWheelZoom: false,
      attributionControl: true,
    }).setView([14.45, -17.0], 8)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap',
    }).addTo(carte.current)

    couche.current = L.layerGroup().addTo(carte.current)

    return () => {
      carte.current?.remove()
      carte.current = null
    }
  }, [])

  useEffect(() => {
    const c = carte.current
    const g = couche.current
    if (!c || !g) return

    g.clearLayers()
    if (situees.length === 0) return

    const points: [number, number][] = []

    for (const v of situees) {
      const position: [number, number] = [Number(v.latitude), Number(v.longitude)]
      points.push(position)

      const marqueur = L.marker(position, {
        icon: L.divIcon({
          className: 'marqueur-prix-enveloppe',
          html: `<span class="marqueur-prix${v.id === villaSurvolee ? ' est-survole' : ''}">${
            v.prix_min != null ? fcfaCourt(v.prix_min) : '—'
          }</span>`,
          iconSize: [0, 0],
        }),
        // Le nom permet d'atteindre le marqueur au clavier et au lecteur d'écran.
        alt: `${v.nom}, ${v.ville}`,
        keyboard: true,
      })

      marqueur.bindPopup(
        `<strong>${v.nom}</strong><br>${v.ville}`,
        { closeButton: false }
      )
      marqueur.on('click', () => navigate(`/villas/${v.id}`))
      marqueur.addTo(g)
    }

    // Recadrer sur les résultats : une carte centrée sur Dakar alors que les
    // résultats sont à Ziguinchor ne sert à rien.
    c.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 })
  }, [situees, villaSurvolee, navigate])

  if (situees.length === 0) {
    return (
      <div className="carte-villas-vide">
        <p className="th-text-3 text-sm">
          Aucune des villas trouvées n'est encore localisée sur la carte.
        </p>
      </div>
    )
  }

  return (
    <div
      ref={conteneur}
      className="carte-villas"
      // La carte double la liste : elle n'apporte rien à un lecteur d'écran,
      // qui parcourt déjà les résultats juste à côté.
      aria-hidden="true"
    />
  )
}
