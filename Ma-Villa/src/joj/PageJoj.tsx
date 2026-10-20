import { useState } from 'react'
import { Bus, MapPin, MessageCircle, Ticket } from 'lucide-react'
import api from '../services/api'
import PageHeader from '../components/PageHeader'
import Footer from '../components/Footer'
import Seo from '../components/Seo'
import VillaCard from '../components/VillaCard'
import { VillaCardSkeleton } from '../components/Skeleton'
import Button from '../components/ui/Button'
import PageGardee from '../components/PageGardee'
import { useConfig } from '../context/ConfigContext'
import { useRequete } from '../lib/useRequete'
import { lienWhatsApp } from '../lib/contact'
import { enSlug } from '../lib/villes'
import Lien from '../i18n/Lien'
import { useLangue } from '../i18n/langue'
import DemandeService from '../prestations/DemandeService'
import ListePrestations from '../prestations/ListePrestations'
import { allerAuFormulaire } from '../prestations/defilement'
import { useCatalogue } from '../prestations/useCatalogue'
import { CHEMIN_FAMILLE, TEXTES_PRESTATIONS } from '../prestations/textes'
import { CHEMIN_JOJ, SITES, VARIABLE_JOJ } from './index'
import { TEXTES_JOJ, type TextesJoj } from './textes'
import type { FamillePrestation, PageResult, VillaResume } from '../types'

/** Combien de cartes par ville : de quoi montrer, sans refaire le catalogue. */
const PAR_VILLE = 3

/**
 * La vitrine des JOJ Dakar 2026, pour les familles et proches des athlètes.
 *
 * Elle ne possède rien : les logements sont ceux du catalogue, les services
 * ceux de `src/prestations/`. Elle les rassemble pour un public et une
 * quinzaine de jours, puis se retire (`JOJ_ACTIF=false`) sans rien emporter.
 */
export default function PageJoj() {
  const { joj } = useConfig()

  return (
    <PageGardee ouvert={joj.actif} variable={VARIABLE_JOJ}>
      <Contenu />
    </PageGardee>
  )
}

function Contenu() {
  const { langue, lien } = useLangue()
  const t = TEXTES_JOJ[langue]
  const tp = TEXTES_PRESTATIONS[langue]
  const { reservations } = useConfig()
  const catalogue = useCatalogue()
  const [prestation, setPrestation] = useState('')

  // Tous les services fermés : la vitrine ne montre que les logements. Un
  // 404 n'est pas une panne, c'est « rien d'ouvert ».
  const sansServices = catalogue.statut === 404
  const familles = catalogue.donnees ? Object.keys(catalogue.donnees.familles) as FamillePrestation[] : []

  const choisir = (cle: string) => {
    setPrestation(cle)
    allerAuFormulaire()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-1)' }}>
      <Seo titre={t.seo.titre} description={t.seo.description} chemin={lien(CHEMIN_JOJ)} />
      <PageHeader />

      {/* ── En-tête ─────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-10 pb-12 md:pt-14">
        <p className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: 'var(--accent)' }}>
          {t.eyebrow}
        </p>
        <h1 className="text-3xl md:text-5xl font-normal th-text-1 mb-5 max-w-3xl" style={{ letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          {t.titre}
        </h1>
        <p className="th-text-2 leading-relaxed max-w-2xl mb-8">{t.intro}</p>
        <div className="flex flex-wrap gap-3">
          {!sansServices && <a href="#demande" className="btn btn-primaire btn-md">{t.demander}</a>}
          <a href="#ou-loger" className={`btn ${sansServices ? 'btn-primaire' : 'btn-secondaire'} btn-md`}>{t.voirLogements}</a>
        </div>
      </section>

      {/* ── Où loger ────────────────────────────────────────── */}
      <section id="ou-loger" className="px-6 py-14" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-normal th-text-1 mb-2" style={{ letterSpacing: '-0.02em' }}>{t.ouLoger}</h2>
          <p className="th-text-2 mb-8">{t.ouLogerSous}</p>

          <div className="grid gap-4 md:grid-cols-3 mb-12">
            {SITES.map((site) => (
              <div key={site.cle} className="rounded-2xl px-5 py-6 th-card">
                <p className="font-semibold th-text-1 mb-2 flex items-center gap-2">
                  <MapPin size={16} aria-hidden="true" style={{ color: 'var(--accent)' }} />
                  {site.nom}
                </p>
                <p className="text-sm th-text-2 leading-relaxed">{t.sites[site.cle]}</p>
                {!site.ville && <p className="text-sm th-text-3 leading-relaxed mt-3">{t.aucunLogementDiamniadio}</p>}
              </div>
            ))}
          </div>

          {SITES.filter((s) => s.ville).map((site) => (
            <LogementsDe key={site.cle} ville={site.ville as string} t={t} />
          ))}

          <p className="th-text-2 text-sm mt-2">
            {t.aussiThies}{' '}
            <Lien to="/destinations/thies/" className="underline underline-offset-2 th-text-1">{t.voirThies}</Lien>
          </p>
        </div>
      </section>

      {/* ── Les services ────────────────────────────────────── */}
      {!sansServices && (
        <section className="px-6 py-14" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-normal th-text-1 mb-2" style={{ letterSpacing: '-0.02em' }}>{t.services}</h2>
            <p className="th-text-2 mb-8">{t.servicesSous}</p>

            {catalogue.erreur ? (
              <div>
                <p className="mb-3" style={{ color: 'var(--danger)' }}>{langue === 'fr' ? catalogue.erreur : tp.erreurServices}</p>
                <div className="flex flex-wrap gap-3">
                  <Button variante="secondaire" onClick={catalogue.reessayer}>{t.reessayer}</Button>
                  {/* Même sans catalogue, une famille doit pouvoir joindre quelqu'un. */}
                  <a
                    href={lienWhatsApp(reservations.contact.telephone, `${tp.message.entete} (JOJ Dakar 2026)`)}
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
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2].map((n) => <div key={n} className="skeleton" style={{ height: 260, borderRadius: 'var(--r-lg)' }} />)}
              </div>
            ) : (
              <>
                <ListePrestations catalogue={catalogue.donnees} onChoisir={choisir} />
                <p className="text-sm th-text-2 mt-6 flex flex-wrap gap-x-6 gap-y-2">
                  {familles.map((f) => (
                    <Lien key={f} to={CHEMIN_FAMILLE[f]} className="underline underline-offset-2 th-text-1">
                      {t.pageDuService(tp.familles[f].eyebrow)} →
                    </Lien>
                  ))}
                </p>
              </>
            )}
          </div>
        </section>
      )}

      {/* ── La demande ──────────────────────────────────────── */}
      {catalogue.donnees && (
        <section id="demande" className="px-6 py-14" style={{ borderTop: '1px solid var(--border)', scrollMarginTop: '5rem' }}>
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-normal th-text-1 mb-2" style={{ letterSpacing: '-0.02em' }}>{tp.formulaire}</h2>
            <p className="th-text-2 mb-6">{tp.formulaireSous(catalogue.donnees.delai_reponse_heures)}</p>
            <DemandeService
              catalogue={catalogue.donnees}
              prestation={prestation}
              onPrestation={setPrestation}
              origine="joj"
              contexte="JOJ Dakar 2026"
            />
          </div>
        </section>
      )}

      {/* ── Se déplacer, et ce que nous ne sommes pas ───────── */}
      <section className="px-6 py-14" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-6xl mx-auto grid gap-6 md:grid-cols-2">
          <div className="panneau">
            <h2 className="panneau-titre"><Bus size={17} aria-hidden="true" /> {t.seDeplacer}</h2>
            <p className="text-sm th-text-2 leading-relaxed">{t.seDeplacerTexte}</p>
          </div>
          <div className="panneau">
            <h2 className="panneau-titre"><Ticket size={17} aria-hidden="true" /> {t.billets}</h2>
            <p className="text-sm th-text-2 leading-relaxed mb-3">
              <a href="https://tickets.dakar2026.org" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 th-text-1">
                tickets.dakar2026.org
              </a>
            </p>
            <p className="text-xs th-text-3 leading-relaxed">{t.avertissement}</p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

/** Les premiers logements d'une ville des Jeux, et le lien vers tous les autres. */
function LogementsDe({ ville, t }: { ville: string; t: TextesJoj }) {
  const { donnees, chargement, erreur, reessayer } = useRequete<PageResult<VillaResume>>(
    async (signal) => (await api.get(`/villas?ville=${encodeURIComponent(ville)}&par_page=${PAR_VILLE}`, { signal })).data,
    `joj-${ville}`,
  )

  const villas = (donnees?.data ?? []).slice(0, PAR_VILLE)
  const total = donnees?.total ?? villas.length

  // Une ville sans logement ne prend pas de place : elle est déjà décrite plus haut.
  if (!chargement && !erreur && villas.length === 0) return null

  return (
    <div className="mb-12">
      <div className="flex items-end justify-between gap-4 mb-5">
        <h3 className="text-xl font-normal th-text-1">{ville}</h3>
        {total > 0 && (
          <Lien to={`/destinations/${enSlug(ville)}/`} className="text-sm th-text-2 hover:th-text-1 transition-colors">
            {t.voirTous(total, ville)} →
          </Lien>
        )}
      </div>

      {erreur ? (
        <div>
          <p className="mb-3" style={{ color: 'var(--danger)' }}>{erreur}</p>
          <Button variante="secondaire" onClick={reessayer}>{t.reessayer}</Button>
        </div>
      ) : chargement ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: PAR_VILLE }, (_, i) => <VillaCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {villas.map((villa) => <VillaCard key={villa.id} villa={villa} />)}
        </div>
      )}
    </div>
  )
}
