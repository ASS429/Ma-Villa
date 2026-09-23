import { Link, useParams } from 'react-router-dom'
import api from '../../services/api'
import PageHeader from '../../components/PageHeader'
import Footer from '../../components/Footer'
import Seo from '../../components/Seo'
import VillaCard from '../../components/VillaCard'
import { VillaCardSkeleton } from '../../components/Skeleton'
import Button from '../../components/ui/Button'
import { useRequete } from '../../lib/useRequete'
import { useConfig } from '../../context/ConfigContext'
import { enSlug } from '../../lib/villes'
import { fcfa } from '../../lib/format'
import type { PageResult, VillaResume } from '../../types'

/**
 * Une page par destination : « Hébergements à Saly ».
 *
 * ── Pourquoi une page, et pas un filtre ──────────────────────────
 * La liste sait déjà afficher « Hébergements à Saly » à l'adresse
 * `/hebergements?ville=Saly`. Mais un paramètre de requête ne se pré-rend pas —
 * l'hébergement est statique, un fichier par chemin — donc il n'entre pas au
 * plan de site et Google n'en voit que le gabarit. Or « location villa Saly »
 * est exactement ce que les gens tapent.
 *
 * `/destinations/saly/` est un chemin : il a son fichier, son titre, son texte,
 * ses liens, et il figure au plan de site.
 *
 * ── Pourquoi un écran à part, plus simple que la liste ───────────
 * Réemployer l'écran de liste aurait mêlé deux sources de vérité pour un même
 * critère — la ville viendrait du chemin *et* des paramètres, et retirer le
 * filtre aurait laissé la page se contredire. Une page d'entrée n'a pas besoin
 * des filtres : elle montre, et renvoie vers la liste pour affiner.
 */
export default function Destination() {
  const { ville: slug } = useParams()
  const { annonces, chargee } = useConfig()

  // La ville canonique, retrouvée depuis l'adresse. On ne fait jamais confiance
  // au slug pour l'affichage : « saly » doit redevenir « Saly ».
  const ville = annonces.villes.find((v) => enSlug(v) === slug)

  const { donnees, chargement, erreur, reessayer } = useRequete<PageResult<VillaResume>>(
    (signal) => (ville
      ? api.get(`/villas?ville=${encodeURIComponent(ville)}&par_page=24`, { signal })
        .then((r) => r.data)
      : Promise.resolve(null as unknown as PageResult<VillaResume>)),
    ville ?? '',
  )

  const villas = donnees?.data ?? []
  const nom = ville ?? ''

  /*
   | Tant que la ville n'est pas connue, on ne rend **ni titre ni canonique**.
   |
   | Deux raisons. La page pré-rendue porte déjà les bonnes métadonnées : les
   | écraser par un titre provisoire, c'est risquer qu'un robot les lise
   | pendant ce battement. Et l'écran affichait « Hébergements à » sans ville,
   | en se déclarant indexable — constaté au navigateur.
   |
   | `chargee` distingue « pas encore su » de « inconnue » : même leçon que les
   | écrans de la boutique, qui redirigeaient avant d'avoir la réponse.
   */
  if (!ville && !chargee) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-1)' }}>
        <PageHeader />
        <div className="max-w-6xl mx-auto px-6 py-10 md:py-14">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => <VillaCardSkeleton key={i} />)}
          </div>
        </div>
      </div>
    )
  }

  if (!ville) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-1)' }}>
        <Seo
          titre="Destination inconnue"
          description="Cette destination n'existe pas encore sur PasseTemps."
          indexable={false}
        />
        <PageHeader />
        <div className="max-w-2xl mx-auto px-6 py-20 text-center">
          <h1 className="text-2xl font-normal mb-3 th-text-1">Cette destination n'existe pas encore</h1>
          <p className="mb-6" style={{ color: 'var(--text-2)' }}>
            Nous n'avons pas encore d'annonce à cette adresse. Regardez les hébergements disponibles.
          </p>
          <Link to="/hebergements"><Button>Voir tous les hébergements</Button></Link>
        </div>
        <Footer />
      </div>
    )
  }

  const plancher = villas.reduce<number | null>((min, v) => {
    const p = v.prix_min == null ? null : Number(v.prix_min)
    return p == null ? min : (min == null || p < min ? p : min)
  }, null)

  const description = villas.length
    ? `${villas.length} hébergement${villas.length > 1 ? 's' : ''} à louer à ${nom}`
      + `${plancher != null ? `, à partir de ${fcfa(plancher)}` : ''}`
      + ' — villas, résidences, appartements et chambres, tarifs affichés en FCFA.'
    : `Villas, résidences, appartements et chambres à louer à ${nom}, au Sénégal.`

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-1)' }}>
      <Seo
        titre={`Hébergements à ${nom}`}
        description={description}
        chemin={`/destinations/${slug}/`}
        image={villas[0]?.photos?.[0]?.url}
        donneesStructurees={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: `Hébergements à ${nom}`,
          description,
          about: { '@type': 'Place', name: nom, address: { '@type': 'PostalAddress', addressLocality: nom, addressCountry: 'SN' } },
        }}
      />
      <PageHeader />

      <div className="max-w-6xl mx-auto px-6 py-10 md:py-14">
        <p className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: 'var(--accent)' }}>
          Destination
        </p>
        <h1 className="text-2xl md:text-3xl font-normal th-text-1 mb-2" style={{ letterSpacing: '-0.02em' }}>
          Hébergements à {nom}
        </h1>
        <p className="mb-8" style={{ color: 'var(--text-2)' }}>{description}</p>

        {erreur && (
          <div className="mb-8">
            <p className="mb-3" style={{ color: 'var(--danger)' }}>{erreur}</p>
            <Button variante="secondaire" onClick={reessayer}>Réessayer</Button>
          </div>
        )}

        {chargement ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => <VillaCardSkeleton key={i} />)}
          </div>
        ) : villas.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {villas.map((villa, i) => (
              <VillaCard key={villa.id} villa={villa} prioritaire={i < 3} />
            ))}
          </div>
        ) : (
          !erreur && (
            <p style={{ color: 'var(--text-2)' }}>
              Aucune annonce à {nom} pour le moment.
            </p>
          )
        )}

        <div className="mt-10 flex flex-wrap gap-3">
          <Link to={`/hebergements?ville=${encodeURIComponent(nom)}`}>
            <Button variante="secondaire">Affiner la recherche à {nom}</Button>
          </Link>
          <Link to="/hebergements">
            <Button variante="secondaire">Toutes les destinations</Button>
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  )
}
