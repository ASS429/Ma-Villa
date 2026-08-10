import { Link } from 'react-router-dom'
import FadeIn from './FadeIn'
import BarreRecherche from './BarreRecherche'

export default function Hero() {
  return (
    <div className="flex-1 flex flex-col px-6 md:px-12 lg:px-16 pb-16 lg:pb-24 justify-end">
      <div className="max-w-4xl">
        <h1
          className="text-4xl md:text-5xl lg:text-6xl font-light mb-4 text-white"
          style={{ letterSpacing: '-0.04em', fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          Votre villa de rêve
          <span className="block">au Sénégal.</span>
        </h1>

        <FadeIn delay={200} duration={800}>
          <p className="text-base md:text-lg mb-7 leading-relaxed text-white/85 max-w-2xl">
            Villas, appartements et piscines à la journée — à Saly, Mbour, Dakar
            et partout au Sénégal. Réservation directe auprès des propriétaires.
          </p>
        </FadeIn>
      </div>

      <FadeIn delay={400} duration={800}>
        <BarreRecherche variante="hero" />
      </FadeIn>

      <FadeIn delay={700} duration={800}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-5 text-sm text-white/75">
          <Link to="/villas" className="underline underline-offset-4 hover:text-white transition-colors">
            Voir toutes les villas
          </Link>
          <span className="hidden sm:inline text-white/30">·</span>
          <Link to="/register" className="underline underline-offset-4 hover:text-white transition-colors">
            Publier ma villa
          </Link>
        </div>
      </FadeIn>
    </div>
  )
}
