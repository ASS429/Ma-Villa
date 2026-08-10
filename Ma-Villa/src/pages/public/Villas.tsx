import { Suspense, lazy, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import VillaCard from '../../components/VillaCard'
import PageHeader from '../../components/PageHeader'
import ScrollReveal from '../../components/ScrollReveal'
import BarreRecherche from '../../components/BarreRecherche'
import Button from '../../components/ui/Button'
import FiltresActifs from '../../components/recherche/FiltresActifs'
import type { CleFiltre } from '../../lib/filtres'
import FeuilleFiltres, { type Brouillon } from '../../components/recherche/FeuilleFiltres'
import EtatVide from '../../components/recherche/EtatVide'
import { useSuggestionsFiltres } from '../../components/recherche/useSuggestionsFiltres'

// Leaflet ne concerne que cette page : le sortir du paquet initial évite de
// le faire télécharger à tous les visiteurs de l'accueil.
const CarteVillas = lazy(() => import('../../components/CarteVillas'))
import Footer from '../../components/Footer'
import Seo from '../../components/Seo'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { VillaCardSkeleton } from '../../components/Skeleton'
import { messageErreur } from '../../lib/erreurs'
import { useRequete } from '../../lib/useRequete'
import type { PageResult, VillaResume } from '../../types'

const TRIS = [
  { value: '', label: 'Plus récentes' },
  { value: 'prix_asc', label: 'Prix croissant' },
  { value: 'prix_desc', label: 'Prix décroissant' },
  { value: 'note', label: 'Mieux notées' },
]

/** Critères pilotés par l'URL : une recherche reste partageable et rechargeable. */
const CLES_FILTRES = [
  'ville', 'date_debut', 'date_fin', 'capacite',
  'prix_min', 'prix_max', 'type_logement', 'note_min', 'tri',
] as const

type Filtres = Record<(typeof CLES_FILTRES)[number], string>

const FILTRES_VIDES = Object.fromEntries(CLES_FILTRES.map((k) => [k, ''])) as Filtres

function plageDePages(courante: number, derniere: number): (number | '…')[] {
  if (derniere <= 7) return Array.from({ length: derniere }, (_, i) => i + 1)
  if (courante <= 4) return [1, 2, 3, 4, 5, '…', derniere]
  if (courante >= derniere - 3) return [1, '…', derniere - 4, derniere - 3, derniere - 2, derniere - 1, derniere]
  return [1, '…', courante - 1, courante, courante + 1, '…', derniere]
}

function IconFilter() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
    </svg>
  )
}

export default function Villas() {
  const { user } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()

  const [panneauOuvert, setPanneauOuvert] = useState(false)
  const [vueCarte, setVueCarte] = useState(false)
  const [villaSurvolee, setVillaSurvolee] = useState<number | null>(null)
  const [favorisIds, setFavorisIds] = useState<Set<number>>(new Set())

  // Les filtres sont dérivés de l'URL, pas dupliqués dans un état parallèle :
  // une recherche reste ainsi partageable, rechargeable et navigable au retour.
  const filtres: Filtres = { ...FILTRES_VIDES }
  for (const cle of CLES_FILTRES) filtres[cle] = params.get(cle) ?? ''
  const page = Number(params.get('page') ?? 1)
  const requete = params.toString()

  // Paires [clé, valeur] des filtres réellement posés : sert aux pastilles
  // retirables et au diagnostic de l'état vide.
  const filtresActifs = CLES_FILTRES
    .filter((k) => k !== 'tri' && filtres[k])
    .map((k) => [k as CleFiltre, filtres[k]] as [CleFiltre, string])
  const nbFiltresActifs = filtresActifs.length

  const { donnees, chargement, erreur, reessayer } = useRequete<PageResult<VillaResume>>(
    async (signal) => {
      const { data } = await api.get('/villas', {
        params: Object.fromEntries(new URLSearchParams(requete)),
        signal,
      })
      return data
    },
    requete,
    { messageErreurParDefaut: 'Impossible de charger les villas.' }
  )

  const villas = donnees?.data ?? []
  const pagination = {
    page: donnees?.current_page ?? page,
    dernierePage: donnees?.last_page ?? 1,
    total: donnees?.total ?? villas.length,
  }

  useEffect(() => {
    if (user?.role !== 'client') return
    api.get('/favoris')
      .then((res) => setFavorisIds(new Set(res.data.map((f: { villa_id: number }) => f.villa_id))))
      .catch(() => { /* sans favoris, la page reste pleinement utilisable */ })
  }, [user])

  const appliquer = (nouveaux: Partial<Filtres>, resetPage = true) => {
    const fusion = { ...filtres, ...nouveaux }
    const suivants = new URLSearchParams()
    for (const cle of CLES_FILTRES) if (fusion[cle]) suivants.set(cle, fusion[cle])
    if (!resetPage && page > 1) suivants.set('page', String(page))
    setParams(suivants)
  }

  const reinitialiser = () => setParams(new URLSearchParams())

  /** Retire un seul critère, en gardant les autres. */
  const retirerFiltre = (cle: CleFiltre) => {
    const suivants = new URLSearchParams(params)
    suivants.delete(cle)
    suivants.delete('page')
    // Une borne de dates seule n'a pas de sens.
    if (cle === 'date_debut') suivants.delete('date_fin')
    if (cle === 'date_fin') suivants.delete('date_debut')
    setParams(suivants)
  }

  const { suggestions, recherche: chercheSuggestions } = useSuggestionsFiltres(
    filtresActifs,
    !chargement && !erreur && villas.length === 0,
    requete
  )

  const allerPage = (p: number) => {
    const suivants = new URLSearchParams(params)
    suivants.set('page', String(p))
    setParams(suivants)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleFavori = async (e: React.MouseEvent, villaId: number) => {
    e.preventDefault()
    if (!user || user.role !== 'client') return

    const etait = favorisIds.has(villaId)

    const basculer = (present: boolean) => setFavorisIds((p) => {
      const n = new Set(p)
      if (present) n.add(villaId)
      else n.delete(villaId)
      return n
    })

    basculer(!etait) // bascule optimiste : le cœur réagit immédiatement
    try {
      if (etait) await api.delete(`/villas/${villaId}/favoris`)
      else await api.post(`/villas/${villaId}/favoris`, {})
    } catch (err) {
      basculer(etait) // l'appel a échoué : on revient à l'état réel
      toast.erreur(messageErreur(err, 'Impossible de mettre à jour vos favoris.'))
    }
  }

  const descriptionSeo = filtres.ville
    ? `Villas et logements à louer à ${filtres.ville} — tarifs en FCFA, disponibilités en temps réel.`
    : 'Toutes les villas, appartements et piscines à louer au Sénégal. Filtrez par ville, dates, budget et type de logement.'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-1)' }}>
      <Seo
        titre={filtres.ville ? `Villas à ${filtres.ville}` : 'Toutes les villas'}
        description={descriptionSeo}
        chemin="/villas"
      />
      <PageHeader />

      <div className="max-w-6xl mx-auto px-6 py-10 md:py-14">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: 'var(--accent)' }}>
            Toutes les annonces
          </p>
          <h1 className="text-2xl md:text-3xl font-normal th-text-1" style={{ letterSpacing: '-0.02em' }}>
            Villas disponibles
          </h1>
        </div>

        {/* Destination + dates + voyageurs, cohérente avec l'accueil */}
        <div className="mb-4">
          <BarreRecherche
            variante="page"
            valeursInitiales={filtres}
            onRecherche={(criteres) => appliquer({ ...FILTRES_VIDES, ...criteres, tri: filtres.tri })}
          />
        </div>

        {/* Filtres secondaires */}
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <button
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl transition-colors th-text-1"
            style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)', minHeight: 40 }}
            onClick={() => setPanneauOuvert((v) => !v)}
            aria-expanded={panneauOuvert}
          >
            <IconFilter />
            Filtres
            {nbFiltresActifs > 0 && (
              <span
                className="text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {nbFiltresActifs}
              </span>
            )}
          </button>

          <div className="flex items-center gap-3">
            {/* Bascule liste / carte : la carte n'est pas décorative — à Saly,
                « à 300 m de la plage » et « à 3 km » sont deux produits
                différents au même prix. */}
            <div className="bascule-vue" role="group" aria-label="Affichage des résultats">
              <button
                type="button"
                onClick={() => setVueCarte(false)}
                aria-pressed={!vueCarte}
                className={vueCarte ? undefined : 'est-actif'}
              >
                Liste
              </button>
              <button
                type="button"
                onClick={() => setVueCarte(true)}
                aria-pressed={vueCarte}
                className={vueCarte ? 'est-actif' : undefined}
              >
                Carte
              </button>
            </div>

            <label htmlFor="tri" className="text-sm th-text-2">Trier par</label>
            <select
              id="tri"
              value={filtres.tri}
              onChange={(e) => appliquer({ tri: e.target.value })}
              className="rounded-xl px-3 py-2 text-sm th-input-field"
            >
              {TRIS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        {/* Pastilles des filtres posés : sans elles, les critères devenaient
            invisibles une fois la feuille refermée, et « aucun résultat »
            s'affichait sans qu'on comprenne pourquoi. */}
        <FiltresActifs
          actifs={filtresActifs}
          onRetirer={retirerFiltre}
          onToutEffacer={reinitialiser}
        />

        {panneauOuvert && (
          <FeuilleFiltres
            initiaux={{
              prix_min: filtres.prix_min,
              prix_max: filtres.prix_max,
              type_logement: filtres.type_logement,
              note_min: filtres.note_min,
            } as Brouillon}
            nbResultats={pagination.total}
            onAppliquer={(b) => { appliquer(b); setPanneauOuvert(false) }}
            onEffacer={() => { reinitialiser(); setPanneauOuvert(false) }}
            onFermer={() => setPanneauOuvert(false)}
          />
        )}

        {/* Résultats */}
        {chargement ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((n) => <VillaCardSkeleton key={n} />)}
          </div>
        ) : erreur ? (
          <div className="text-center py-24">
            <p className="text-lg font-medium th-text-1 mb-2">Chargement impossible</p>
            <p className="text-sm th-text-2 mb-6">{erreur}</p>
            <Button onClick={reessayer} variante="primaire" taille="sm">Réessayer</Button>
          </div>
        ) : villas.length === 0 ? (
          <EtatVide
            actifs={filtresActifs}
            suggestions={suggestions}
            recherche={chercheSuggestions}
            avecDates={Boolean(filtres.date_debut)}
            onRetirer={retirerFiltre}
            onToutEffacer={reinitialiser}
          />
        ) : (
          <>
            <p className="text-sm mb-6 th-text-2">
              {pagination.total} villa{pagination.total > 1 ? 's' : ''} trouvée{pagination.total > 1 ? 's' : ''}
              {pagination.dernierePage > 1 && (
                <span className="th-text-3"> · page {pagination.page}/{pagination.dernierePage}</span>
              )}
            </p>

            {vueCarte ? (
              <div className="vue-carte">
                {/* Liste et carte côte à côte : survoler une carte de villa
                    met en avant son marqueur, et inversement. */}
                <div className="vue-carte-liste">
                  {villas.map((villa) => (
                    <div
                      key={villa.id}
                      onMouseEnter={() => setVillaSurvolee(villa.id)}
                      onMouseLeave={() => setVillaSurvolee(null)}
                    >
                      <VillaCard
                        villa={villa}
                        isFavori={favorisIds.has(villa.id)}
                        onToggleFavori={user?.role === 'client' ? (e) => toggleFavori(e, villa.id) : undefined}
                      />
                    </div>
                  ))}
                </div>
                <div className="vue-carte-plan">
                  <Suspense fallback={<div className="carte-villas-vide"><p className="th-text-3 text-sm">Chargement de la carte…</p></div>}>
                    <CarteVillas villas={villas} villaSurvolee={villaSurvolee} />
                  </Suspense>
                </div>
              </div>
            ) : (
              <ScrollReveal className="sr-stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {villas.map((villa, i) => (
                  <VillaCard
                    key={villa.id}
                    villa={villa}
                    prioritaire={i < 3}
                    isFavori={favorisIds.has(villa.id)}
                    onToggleFavori={user?.role === 'client' ? (e) => toggleFavori(e, villa.id) : undefined}
                  />
                ))}
              </ScrollReveal>
            )}

            {pagination.dernierePage > 1 && (
              <nav className="flex items-center justify-center gap-1.5 mt-10 flex-wrap" aria-label="Pagination">
                <button
                  onClick={() => allerPage(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-3.5 py-2 rounded-xl text-sm transition-all disabled:opacity-30 th-text-1"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', minHeight: 40 }}
                  aria-label="Page précédente"
                >
                  ←
                </button>
                {plageDePages(pagination.page, pagination.dernierePage).map((p, i) =>
                  p === '…' ? (
                    <span key={`e-${i}`} className="px-1 text-sm th-text-3 select-none">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => allerPage(p as number)}
                      className="w-10 h-10 rounded-xl text-sm font-medium transition-all"
                      aria-current={p === pagination.page ? 'page' : undefined}
                      style={
                        p === pagination.page
                          ? { background: 'var(--accent)', color: '#fff' }
                          : { background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }
                      }
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  onClick={() => allerPage(pagination.page + 1)}
                  disabled={pagination.page === pagination.dernierePage}
                  className="px-3.5 py-2 rounded-xl text-sm transition-all disabled:opacity-30 th-text-1"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', minHeight: 40 }}
                  aria-label="Page suivante"
                >
                  →
                </button>
              </nav>
            )}
          </>
        )}
      </div>

      <Footer />
    </div>
  )
}
