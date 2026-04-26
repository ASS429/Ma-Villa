import { Link } from 'react-router-dom'
import AnimatedHeading from './AnimatedHeading'
import FadeIn from './FadeIn'

export default function Hero() {
  return (
    <div className="flex-1 flex flex-col px-6 md:px-12 lg:px-16 pb-14 lg:pb-20 justify-end">
      <div className="lg:grid lg:grid-cols-2 lg:items-end gap-8">
        <div>
          <AnimatedHeading
            text={"Votre villa de rêve\nau Sénégal."}
            className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-light mb-5 text-white"
            style={{ letterSpacing: '-0.04em', fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          />
          <FadeIn delay={800} duration={1000}>
            <p className="text-base md:text-lg mb-6 leading-relaxed text-white/80">
              Découvrez des villas, appartements et maisons d'exception<br className="hidden md:block" />
              à Saly, Dakar, Mbour et partout au Sénégal.
            </p>
          </FadeIn>
          <FadeIn delay={1200} duration={1000}>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/villas"
                className="bg-white text-stone-900 px-8 py-3.5 rounded-xl font-medium transition-all hover:scale-[1.03] hover:shadow-lg hover:bg-gray-100"
              >
                Voir les villas
              </Link>
              <Link
                to="/register"
                className="px-8 py-3.5 rounded-xl font-medium transition-all hover:scale-[1.03] text-white"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                Publier ma villa
              </Link>
            </div>
          </FadeIn>
        </div>

        <FadeIn delay={1400} duration={1000} className="flex items-end justify-start lg:justify-end mt-10 lg:mt-0">
          <div
            className="px-6 py-4 rounded-2xl"
            style={{
              background: 'rgba(255,255,255,0.10)',
              border: '1px solid rgba(255,255,255,0.20)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <p className="text-lg md:text-xl lg:text-2xl font-light text-white" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", letterSpacing: '-0.02em' }}>
              Dakar. Saly. Mbour.
            </p>
          </div>
        </FadeIn>
      </div>
    </div>
  )
}
