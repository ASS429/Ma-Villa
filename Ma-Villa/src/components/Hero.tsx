import FadeIn from './FadeIn'
import BarreRecherche from './BarreRecherche'
import { useConfig } from '../context/ConfigContext'
import { lienAppel } from '../lib/contact'
import { useLangue } from '../i18n/langue'
import { TEXTES_ACCUEIL } from '../i18n/accueil'

const DESTINATIONS = ['Saly', 'Mbour', 'Dakar', 'Ziguinchor']

/**
 * Hero — planche 03. La recherche en est l'objet central : l'accueil n'en
 * proposait aucune, et le visiteur devait atteindre /villas puis découvrir un
 * panneau de filtres.
 */
export default function Hero() {
  const { paiement, reservations } = useConfig()
  const t = TEXTES_ACCUEIL[useLangue().langue].hero
  const moyens = paiement.moyens.map((m) => m.nom).join(t.ou)

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

        {/* Le titre se raccourcit en mobile : « réservé en trois gestes »
            occupe deux lignes de plus sur 375 px, au détriment de la recherche
            qui doit rester visible sans défiler. */}
        <h1
          className="mb-5 text-white"
          style={{ font: 'var(--t-display)', letterSpacing: 'var(--t-display-ls)' }}
        >
          {t.titre}
          {/* « Réservé en trois gestes » serait une promesse fausse tant que la
              réservation en ligne est suspendue : le titre s'arrête alors là. */}
          {reservations.ouvertes && (
            <>
              <span className="hidden md:inline">,</span>
              <span className="hidden md:block">{t.suite}</span>
            </>
          )}
        </h1>

        <FadeIn delay={200} duration={700}>
          <p className="mb-8 text-white/85 max-w-2xl" style={{ font: 'var(--t-body-lg)' }}>
            <span className="hidden md:inline">
              {t.accroche}
            </span>
            <span className="md:hidden">
              {t.accrocheCourte}
            </span>
            {/* Le paiement est annoncé mais inactif : le dire au futur tant que
                c'est le cas, plutôt que de laisser croire qu'on peut régler ici. */}
            {!reservations.ouvertes ? (
              <>
                {t.bientot(reservations.contact.nom)}
                <a href={lienAppel(reservations.contact.telephone)} className="text-white underline underline-offset-4">
                  {reservations.contact.telephone}
                </a>.
              </>
            ) : paiement.actif
              ? t.paiement(moyens)
              : t.paiementBientot(moyens)}
          </p>
        </FadeIn>
      </div>

      <FadeIn delay={350} duration={700}>
        <BarreRecherche variante="hero" />
      </FadeIn>
    </div>
  )
}
