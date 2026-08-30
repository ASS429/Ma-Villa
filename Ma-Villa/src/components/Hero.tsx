import FadeIn from './FadeIn'
import BarreRecherche from './BarreRecherche'
import { useConfig } from '../context/ConfigContext'

const DESTINATIONS = ['Saly', 'Mbour', 'Dakar', 'Ziguinchor']

/**
 * Hero — planche 03. La recherche en est l'objet central : l'accueil n'en
 * proposait aucune, et le visiteur devait atteindre /villas puis découvrir un
 * panneau de filtres.
 */
export default function Hero() {
  const { paiement } = useConfig()
  const moyens = paiement.moyens.map((m) => m.nom).join(' ou ')

  return (
    <div className="flex-1 flex flex-col justify-end px-6 md:px-12 lg:px-16 pb-14 lg:pb-20">
      <div className="max-w-3xl">
        <FadeIn delay={0} duration={600}>
          <p
            className="mb-4 text-white/80"
            style={{ font: 'var(--t-eyebrow)', letterSpacing: 'var(--t-eyebrow-ls)', textTransform: 'uppercase' }}
          >
            <span className="md:hidden">{DESTINATIONS.slice(0, 3).join(' · ')}</span>
            <span className="hidden md:inline">{DESTINATIONS.join(' · ')}</span>
          </p>
        </FadeIn>

        {/* Le titre se raccourcit en mobile : « réservée en trois gestes »
            occupe deux lignes de plus sur 375 px, au détriment de la recherche
            qui doit rester visible sans défiler. */}
        <h1
          className="mb-5 text-white"
          style={{ font: 'var(--t-display)', letterSpacing: 'var(--t-display-ls)' }}
        >
          Votre villa au Sénégal
          <span className="hidden md:inline">,</span>
          <span className="hidden md:block">réservée en trois gestes</span>
        </h1>

        <FadeIn delay={200} duration={700}>
          <p className="mb-8 text-white/85 max-w-2xl" style={{ font: 'var(--t-body-lg)' }}>
            <span className="hidden md:inline">
              Villas, résidences, appartements, chambres — à la nuitée comme à la journée.
            </span>
            <span className="md:hidden">
              Villas, résidences, appartements ou chambres.
            </span>
            {/* Le paiement est annoncé mais inactif : le dire au futur tant que
                c'est le cas, plutôt que de laisser croire qu'on peut régler ici. */}
            {paiement.actif
              ? ` Paiement ${moyens}.`
              : ` Paiement ${moyens} bientôt disponible.`}
          </p>
        </FadeIn>
      </div>

      <FadeIn delay={350} duration={700}>
        <BarreRecherche variante="hero" />
      </FadeIn>
    </div>
  )
}
