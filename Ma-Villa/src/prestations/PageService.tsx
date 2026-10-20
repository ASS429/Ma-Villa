import { useState } from 'react'
import { Info, MessageCircle } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Footer from '../components/Footer'
import Seo from '../components/Seo'
import Button from '../components/ui/Button'
import PageGardee from '../components/PageGardee'
import { useConfig } from '../context/ConfigContext'
import { useOuverture, estVisible } from '../lib/ouverture'
import { lienWhatsApp } from '../lib/contact'
import Lien from '../i18n/Lien'
import { useLangue } from '../i18n/langue'
import DemandeService from './DemandeService'
import ListePrestations from './ListePrestations'
import { allerAuFormulaire } from './defilement'
import { useCatalogue } from './useCatalogue'
import { CHEMIN_FAMILLE, TEXTES_PRESTATIONS, VARIABLE_FAMILLE } from './textes'
import type { FamillePrestation } from '../types'

/**
 * La page d'une famille de services : `/transport/`, `/restauration/`.
 *
 * Une page par service, comme l'exploitant l'a voulu — « chacune sa page et
 * son rôle ». Elle vit indépendamment des JOJ, qui ne font que la mettre en
 * avant : la vitrine des Jeux retirée, cette page reste.
 */
export default function PageService({ famille }: { famille: FamillePrestation }) {
  const { services } = useConfig()

  return (
    <PageGardee ouvert={services[famille]} variable={VARIABLE_FAMILLE[famille]}>
      <Contenu famille={famille} />
    </PageGardee>
  )
}

function Contenu({ famille }: { famille: FamillePrestation }) {
  const { langue, lien } = useLangue()
  const t = TEXTES_PRESTATIONS[langue]
  const page = t.familles[famille]
  const { services, reservations } = useConfig()
  const catalogue = useCatalogue()
  const [prestation, setPrestation] = useState('')

  const autre: FamillePrestation = famille === 'transport' ? 'restauration' : 'transport'
  const autreVisible = estVisible(useOuverture(services[autre]))

  const choisir = (cle: string) => {
    setPrestation(cle)
    allerAuFormulaire()
  }

  const delai = catalogue.donnees?.delai_reponse_heures ?? 2

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-1)' }}>
      <Seo titre={page.seo.titre} description={page.seo.description} chemin={lien(CHEMIN_FAMILLE[famille])} />
      <PageHeader />

      <section className="max-w-6xl mx-auto px-6 pt-10 pb-12 md:pt-14">
        <p className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: 'var(--accent)' }}>
          {page.eyebrow}
        </p>
        <h1 className="text-3xl md:text-5xl font-normal th-text-1 mb-5 max-w-3xl" style={{ letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          {page.titre}
        </h1>
        <p className="th-text-2 leading-relaxed max-w-2xl mb-8">{page.intro}</p>

        <ol className="grid gap-4 md:grid-cols-3">
          {t.etapes(delai).map((etape, i) => (
            <li key={i} className="rounded-2xl px-5 py-5 th-card flex gap-4">
              <span
                className="w-9 h-9 rounded-xl flex items-center justify-center font-semibold flex-none"
                style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <span className="text-sm th-text-2 leading-relaxed">{etape}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="px-6 py-14" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-6xl mx-auto">
          {catalogue.erreur ? (
            <div>
              <p className="mb-3" style={{ color: 'var(--danger)' }}>{langue === 'fr' ? catalogue.erreur : t.erreurServices}</p>
              <div className="flex flex-wrap gap-3">
                <Button variante="secondaire" onClick={catalogue.reessayer}>{t.reessayer}</Button>
                {/* Même sans catalogue, le visiteur doit pouvoir joindre quelqu'un. */}
                <a
                  href={lienWhatsApp(reservations.contact.telephone, t.message.entete)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primaire btn-md"
                >
                  <MessageCircle size={16} aria-hidden="true" />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>
          ) : catalogue.chargement || !catalogue.donnees ? (
            <div className="skeleton" style={{ height: 320, borderRadius: 'var(--r-lg)' }} />
          ) : (
            <ListePrestations catalogue={catalogue.donnees} familles={[famille]} onChoisir={choisir} />
          )}

          <p className="text-sm th-text-2 leading-relaxed mt-6 flex gap-2 items-start">
            <Info size={16} aria-hidden="true" className="flex-none mt-0.5" style={{ color: 'var(--accent)' }} />
            <span>{page.conseil}</span>
          </p>
        </div>
      </section>

      <section id="demande" className="px-6 py-14" style={{ borderTop: '1px solid var(--border)', scrollMarginTop: '5rem' }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-normal th-text-1 mb-2" style={{ letterSpacing: '-0.02em' }}>{t.formulaire}</h2>
          <p className="th-text-2 mb-6">{t.formulaireSous(delai)}</p>
          {catalogue.donnees && (
            <DemandeService
              catalogue={catalogue.donnees}
              prestation={prestation}
              onPrestation={setPrestation}
              origine={famille}
              familles={[famille]}
            />
          )}

          {autreVisible && (
            <p className="text-sm th-text-2 mt-8">
              {t.autreService} :{' '}
              <Lien to={CHEMIN_FAMILLE[autre]} className="underline underline-offset-2 th-text-1">
                {t.familles[autre].eyebrow}
              </Lien>
            </p>
          )}
        </div>
      </section>

      <Footer />
    </div>
  )
}
