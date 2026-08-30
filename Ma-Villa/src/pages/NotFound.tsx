import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Footer from '../components/Footer'
import Seo from '../components/Seo'
import VillaCard from '../components/VillaCard'
import api from '../services/api'
import { versPage } from '../lib/page'
import type { VillaResume } from '../types'

interface Destination { ville: string; nb: number }

/**
 * Retrouve une ville dans l'adresse qui a échoué.
 *
 * Un lien mort ressemble le plus souvent à `/villas/villa-teranga-saly-42` ou
 * à `/villas?ville=Saly` : la ville y est presque toujours, et c'est la seule
 * chose exploitable qui reste. On compare aux villes réellement ouvertes
 * plutôt qu'à une liste écrite en dur — une ville qui n'a plus d'annonce ne
 * doit pas servir à proposer « des villas semblables » qui n'existent pas.
 */
function villeDeLAdresse(adresse: string, destinations: Destination[]): string | null {
  const sansAccents = (t: string) =>
    t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

  const cible = sansAccents(decodeURIComponent(adresse))

  return destinations.find((d) => cible.includes(sansAccents(d.ville)))?.ville ?? null
}

/**
 * La page affichée quand une adresse ne mène nulle part.
 *
 * Elle est moins anodine qu'il n'y paraît : **la plupart des visiteurs y
 * arrivent par un lien WhatsApp vers une villa retirée**, WhatsApp étant le
 * premier canal d'acquisition. Une 404 qui n'offre qu'un bouton « retour à
 * l'accueil » perd ce client — il cherchait une villa à Saly, on lui fait
 * tout recommencer.
 *
 * D'où quatre partis pris, tous repris de la planche 31 :
 *
 *   — **le titre nomme la cause la plus probable, pas le code d'erreur.**
 *     « Cette annonce n'est plus en ligne » est vrai neuf fois sur dix ;
 *     « 404 » n'est jamais utile. Le grand chiffre décoratif disparaît :
 *     il occupait la place de la recherche ;
 *   — **un champ de recherche, pas un bouton d'accueil.** La recherche et les
 *     trois premières villes couvrent l'essentiel des cas ;
 *   — **des villas semblables, pas des villas au hasard** : la ville de
 *     l'adresse morte si on la retrouve, les villas en vedette sinon ;
 *   — **la navigation reste.** C'est la différence avec un tunnel : ici, on
 *     veut justement que le visiteur reparte ailleurs sur le site.
 */
export default function NotFound() {
  const emplacement = useLocation()
  const naviguer = useNavigate()
  const [recherche, setRecherche] = useState('')
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [semblables, setSemblables] = useState<VillaResume[]>([])

  const adresse = emplacement.pathname + emplacement.search

  useEffect(() => {
    const controleur = new AbortController()

    api.get('/destinations', { signal: controleur.signal })
      .then((r) => setDestinations(Array.isArray(r.data) ? r.data : []))
      .catch(() => { /* la page reste utile sans les villes */ })

    return () => controleur.abort()
  }, [])

  const ville = useMemo(
    () => villeDeLAdresse(adresse, destinations),
    [adresse, destinations],
  )

  useEffect(() => {
    const controleur = new AbortController()

    // Tant que les destinations ne sont pas là, on ne sait pas encore si
    // l'adresse portait une ville : partir tout de suite sur les vedettes
    // afficherait des villas au hasard, puis les remplacerait — un
    // clignotement qui donne le sentiment d'un écran mal réglé.
    if (destinations.length === 0) return

    const parametres = ville
      ? { ville, per_page: 3 }
      : { vedette: 1, per_page: 3 }

    api.get('/villas', { params: parametres, signal: controleur.signal })
      .then((r) => setSemblables(versPage<VillaResume>(r.data)?.data.slice(0, 3) ?? []))
      .catch(() => { /* pas de suggestions, la recherche reste */ })

    return () => controleur.abort()
  }, [ville, destinations.length])

  function chercher(evenement: React.FormEvent) {
    evenement.preventDefault()
    const terme = recherche.trim()
    naviguer(terme ? `/villas?ville=${encodeURIComponent(terme)}` : '/villas')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-1)' }}>
      {/* `noindex` : une 404 indexée fait remonter une adresse morte dans les
          résultats de recherche, et le visiteur y revient indéfiniment. */}
      <Seo
        titre="Page introuvable"
        description="Cette page n'existe plus. Retrouvez un hébergement au Sénégal — Saly, Mbour, Dakar."
        chemin={emplacement.pathname}
        indexable={false}
      />
      <PageHeader />

      <section className="max-w-3xl mx-auto px-6 py-14 md:py-20">
        <p
          className="mb-3"
          style={{
            font: 'var(--t-eyebrow)',
            letterSpacing: 'var(--t-eyebrow-ls)',
            textTransform: 'uppercase',
            color: 'var(--text-3)',
          }}
        >
          Page introuvable
        </p>

        <h1
          className="th-text-1 mb-4"
          style={{ font: 'var(--t-h1)', letterSpacing: 'var(--t-h1-ls)' }}
        >
          Cette annonce n'est plus en ligne
        </h1>

        <p className="th-text-2 mb-8" style={{ font: 'var(--t-body)', maxWidth: '52ch' }}>
          Le propriétaire l'a retirée, ou le lien est incomplet. Si quelqu'un vous
          l'a envoyée, demandez-lui de le renvoyer — nous gardons les annonces en
          ligne tant qu'elles existent.
        </p>

        {/* La recherche prend la place qu'occupait le « 404 » décoratif. */}
        <form onSubmit={chercher} className="recherche-404" role="search">
          <span className="recherche-404-icone" aria-hidden="true"><Search size={18} /></span>
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Chercher à Saly, Mbour, Dakar…"
            aria-label="Chercher un hébergement par ville"
            autoComplete="off"
          />
          <button type="submit">Chercher</button>
        </form>

        {destinations.length > 0 && (
          <ul className="villes-404">
            {destinations.slice(0, 3).map((d) => (
              <li key={d.ville}>
                <Link to={`/hebergements?ville=${encodeURIComponent(d.ville)}`}>
                  <strong>{d.nb}</strong> hébergement{d.nb > 1 ? 's' : ''} à {d.ville}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {semblables.length > 0 && (
        <section
          className="max-w-6xl mx-auto px-6 pb-16 md:pb-20"
          style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-7)' }}
        >
          <h2 className="th-text-1 mb-6" style={{ font: 'var(--t-h3)' }}>
            {ville ? `Des hébergements semblables, à ${ville}` : 'Nos hébergements en vedette'}
          </h2>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {semblables.map((villa) => <VillaCard key={villa.id} villa={villa} />)}
          </div>
        </section>
      )}

      <Footer />
    </div>
  )
}
