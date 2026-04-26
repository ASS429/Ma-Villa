import { useEffect, useState } from 'react'
import api from '../../services/api'
import VillaCard from '../../components/VillaCard'
import PageHeader from '../../components/PageHeader'
import ScrollReveal from '../../components/ScrollReveal'
import { useAuth } from '../../context/AuthContext'
import { VillaCardSkeleton } from '../../components/Skeleton'

interface Villa {
  id: number
  nom: string
  ville: string
  description: string
  telephone: string
  photos: { url: string; alt: string }[]
  avis: { note: number }[]
  vedette?: boolean
  prix_min?: number
}

const TYPES = [
  { value: '', label: 'Tous les types' },
  { value: 'villa_entiere', label: 'Villa entière' },
  { value: 'appartement', label: 'Appartement' },
  { value: 'chambre', label: 'Chambre' },
  { value: 'piscine', label: 'Piscine' },
]

function getPageRange(current: number, last: number): (number | '...')[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '...', last]
  if (current >= last - 3) return [1, '...', last - 4, last - 3, last - 2, last - 1, last]
  return [1, '...', current - 1, current, current + 1, '...', last]
}

function IconFilter() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
    </svg>
  )
}
function IconChevron({ open }: { open: boolean }) {
  return (
    <svg className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

export default function Villas() {
  const { user } = useAuth()
  const [villas, setVillas] = useState<Villa[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({ ville: '', prix_min: '', prix_max: '', type_logement: '' })
  const [favorisIds, setFavorisIds] = useState<Set<number>>(new Set())
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)

  const activeFilterCount = Object.values(filters).filter(Boolean).length

  const fetchVillas = (f = filters, p = 1) => {
    setIsLoading(true)
    const params = {
      ...Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '')),
      page: p,
    }
    api.get('/villas', { params })
      .then((res) => {
        setVillas(res.data.data ?? res.data)
        setLastPage(res.data.last_page ?? 1)
        setTotal(res.data.total ?? 0)
      })
      .finally(() => setIsLoading(false))
  }

  useEffect(() => { fetchVillas(filters, 1) }, [])

  useEffect(() => {
    if (user?.role === 'client') {
      api.get('/favoris').then((res) => {
        setFavorisIds(new Set(res.data.map((f: any) => f.villa_id)))
      }).catch(() => {})
    }
  }, [user])

  const toggleFavori = async (e: React.MouseEvent, villaId: number) => {
    e.preventDefault()
    if (!user || user.role !== 'client') return
    if (favorisIds.has(villaId)) {
      await api.delete(`/villas/${villaId}/favoris`)
      setFavorisIds((prev) => { const next = new Set(prev); next.delete(villaId); return next })
    } else {
      await api.post(`/villas/${villaId}/favoris`, {})
      setFavorisIds((prev) => new Set(prev).add(villaId))
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchVillas(filters, 1)
    setShowFilters(false)
  }

  const handleReset = () => {
    const empty = { ville: '', prix_min: '', prix_max: '', type_logement: '' }
    setFilters(empty)
    setPage(1)
    fetchVillas(empty, 1)
  }

  const goToPage = (p: number) => {
    setPage(p)
    fetchVillas(filters, p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-1)' }}>
      <PageHeader />

      <div className="max-w-6xl mx-auto px-6 py-10 md:py-14">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: 'var(--accent)' }}>
              Toutes les annonces
            </p>
            <h1 className="text-2xl md:text-3xl font-normal th-text-1" style={{ letterSpacing: '-0.02em' }}>
              Villas disponibles
            </h1>
          </div>

          {/* Mobile filter toggle */}
          <button
            className="md:hidden flex items-center gap-2 text-sm px-4 py-2 rounded-xl transition-colors th-text-1"
            style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
            onClick={() => setShowFilters((v) => !v)}
          >
            <IconFilter />
            Filtres
            {activeFilterCount > 0 && (
              <span
                className="text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
                style={{ background: 'var(--text-1)', color: 'var(--bg)' }}
              >
                {activeFilterCount}
              </span>
            )}
            <IconChevron open={showFilters} />
          </button>
        </div>

        {/* Filters */}
        <div className={`${showFilters ? 'block' : 'hidden'} md:block`}>
          <form
            onSubmit={handleSearch}
            className="rounded-2xl p-5 mb-8"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Ville', key: 'ville', placeholder: 'Saly, Mbour, Dakar...', type: 'text' },
                { label: 'Prix min (FCFA)', key: 'prix_min', placeholder: '0', type: 'number' },
                { label: 'Prix max (FCFA)', key: 'prix_max', placeholder: '500 000', type: 'number' },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key}>
                  <label className="text-xs mb-1.5 block th-text-2">{label}</label>
                  <input
                    type={type}
                    value={filters[key as keyof typeof filters]}
                    onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full rounded-xl px-4 py-2.5 text-sm th-input-field"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs mb-1.5 block th-text-2">Type</label>
                <select
                  value={filters.type_logement}
                  onChange={(e) => setFilters({ ...filters, type_logement: e.target.value })}
                  className="w-full rounded-xl px-4 py-2.5 text-sm th-input-field"
                >
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <button
                type="submit"
                className="px-6 py-2 rounded-xl text-sm font-medium transition-all hover:scale-[1.03]"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Rechercher
              </button>
              {activeFilterCount > 0 && (
                <button type="button" onClick={handleReset} className="text-sm th-text-2 hover:th-text-1 transition-colors">
                  Réinitialiser
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((n) => <VillaCardSkeleton key={n} />)}
          </div>
        ) : villas.length === 0 ? (
          <div className="text-center py-24">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: 'var(--bg-elevated)' }}
            >
              <svg className="w-8 h-8" style={{ color: 'var(--text-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <p className="text-lg font-medium th-text-1 mb-2">Aucune villa trouvée</p>
            <p className="text-sm th-text-2">Essayez d'autres critères de recherche.</p>
            {activeFilterCount > 0 && (
              <button
                onClick={handleReset}
                className="mt-6 text-sm px-5 py-2 rounded-xl transition-colors"
                style={{ background: 'var(--text-1)', color: 'var(--bg)' }}
              >
                Voir toutes les villas
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm mb-6 th-text-2">
              {total || villas.length} villa{(total || villas.length) > 1 ? 's' : ''} trouvée{(total || villas.length) > 1 ? 's' : ''}
              {lastPage > 1 && <span className="th-text-3"> · page {page}/{lastPage}</span>}
            </p>
            <ScrollReveal className="sr-stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {villas.map((villa) => (
                <VillaCard
                  key={villa.id}
                  villa={villa}
                  isFavori={favorisIds.has(villa.id)}
                  onToggleFavori={user?.role === 'client' ? (e) => toggleFavori(e, villa.id) : undefined}
                />
              ))}
            </ScrollReveal>

            {lastPage > 1 && (
              <div className="flex items-center justify-center gap-1.5 mt-10 flex-wrap">
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 1}
                  className="px-3.5 py-2 rounded-xl text-sm transition-all disabled:opacity-30 th-text-1"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                >
                  ←
                </button>
                {getPageRange(page, lastPage).map((p, i) =>
                  p === '...' ? (
                    <span key={`dots-${i}`} className="px-1 text-sm th-text-3 select-none">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => goToPage(p as number)}
                      className="w-9 h-9 rounded-xl text-sm font-medium transition-all"
                      style={
                        p === page
                          ? { background: 'var(--text-1)', color: 'var(--bg)' }
                          : { background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }
                      }
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page === lastPage}
                  className="px-3.5 py-2 rounded-xl text-sm transition-all disabled:opacity-30 th-text-1"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                >
                  →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
