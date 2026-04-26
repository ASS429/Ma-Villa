import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import PageHeader from '../../components/PageHeader'

interface Tarif {
  id: number
  type_tarif: string
  avec_clim: boolean
  avec_buffet: boolean
  prix: number
}

interface Logement {
  id: number
  nom: string
  type: string
  capacite: number
  disponible: boolean
  tarifs: Tarif[]
}

interface Avis {
  id: number
  note: number
  commentaire: string
  client: { name: string }
  created_at: string
}

interface Villa {
  id: number
  nom: string
  description: string
  adresse: string
  ville: string
  telephone: string
  statut: string
  latitude: number | null
  longitude: number | null
  photos: { url: string; alt: string }[]
  logements: Logement[]
  avis: Avis[]
  proprietaire: { name: string }
}

const tarifLabels: Record<string, string> = {
  journee: 'Journée', nuitee: 'Nuitée', demi_journee: 'Demi-journée', pass: 'Pass',
}

const typeLabels: Record<string, string> = {
  villa_entiere: 'Villa entière', appartement: 'Appartement', chambre: 'Chambre', piscine: 'Piscine',
}

/* ─── Reading progress bar ───────────────────────────────────── */

function ReadingProgress() {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement
      const total = el.scrollHeight - el.clientHeight
      setProgress(total > 0 ? (el.scrollTop / total) * 100 : 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-0.5" style={{ background: 'var(--border)' }}>
      <div
        className="h-full"
        style={{ width: `${progress}%`, background: 'var(--accent)', transition: 'width 60ms linear' }}
      />
    </div>
  )
}

/* ─── Lightbox ───────────────────────────────────────────────── */

function Lightbox({ photos, idx, onClose, onPrev, onNext }: {
  photos: { url: string; alt: string }[]
  idx: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') onPrev()
      else if (e.key === 'ArrowRight') onNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onPrev, onNext])

  const current = photos[idx]
  const isVideo = isVideoUrl(current.url)

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.96)' }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-5 text-white/50 hover:text-white text-4xl leading-none transition-colors"
        aria-label="Fermer"
      >
        ×
      </button>
      {photos.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onPrev() }}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-5xl leading-none transition-colors select-none px-2"
          >
            ‹
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onNext() }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-5xl leading-none transition-colors select-none px-2"
          >
            ›
          </button>
        </>
      )}
      <div
        className="max-w-5xl w-full px-16 flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {isVideo ? (
          <video
            src={current.url}
            className="max-h-[85vh] w-full object-contain"
            controls autoPlay loop muted playsInline
          />
        ) : (
          <img
            src={current.url}
            alt={current.alt}
            className="max-h-[85vh] max-w-full object-contain rounded-xl"
          />
        )}
        <p className="text-white/30 text-xs mt-3">{idx + 1} / {photos.length}</p>
      </div>
    </div>
  )
}

/* ─── Helpers ────────────────────────────────────────────────── */

function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov)(\?.*)?$/i.test(url)
}

function StarRating({ note }: { note: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ color: i <= note ? '#FBBF24' : 'var(--border-2)' }}>★</span>
      ))}
    </span>
  )
}

/* ─── Photo gallery ──────────────────────────────────────────── */

function PhotoGallery({
  photos,
  onLightbox,
}: {
  photos: { url: string; alt: string }[]
  onLightbox: (idx: number) => void
}) {
  const [idx, setIdx] = useState(0)

  if (photos.length === 0) {
    return (
      <div
        className="aspect-video rounded-2xl flex items-center justify-center mb-8"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <p className="th-text-3 text-sm">Aucune photo disponible</p>
      </div>
    )
  }

  const prev = () => setIdx((i) => (i - 1 + photos.length) % photos.length)
  const next = () => setIdx((i) => (i + 1) % photos.length)
  const current = photos[idx]
  const isVideo = isVideoUrl(current.url)

  return (
    <div className="mb-8">
      <div className="relative aspect-video rounded-2xl overflow-hidden mb-3 group">
        {isVideo ? (
          <video
            key={current.url}
            src={current.url}
            className="w-full h-full object-cover"
            controls autoPlay loop muted playsInline
          />
        ) : (
          <img
            src={current.url}
            alt={current.alt || `Photo ${idx + 1}`}
            className="w-full h-full object-cover transition-opacity duration-300 cursor-zoom-in"
            onClick={() => onLightbox(idx)}
          />
        )}

        {photos.length > 1 && !isVideo && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full w-9 h-9 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm"
            >
              ‹
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full w-9 h-9 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm"
            >
              ›
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {photos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={`rounded-full transition-all ${i === idx ? 'bg-white w-4 h-1.5' : 'bg-white/40 w-1.5 h-1.5'}`}
                />
              ))}
            </div>
          </>
        )}

        {photos.length > 1 && (
          <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-sm">
            {idx + 1} / {photos.length}
          </div>
        )}

        {!isVideo && (
          <button
            onClick={() => onLightbox(idx)}
            className="absolute bottom-3 left-3 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all"
          >
            ⤢ Agrandir
          </button>
        )}
      </div>

      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {photos.map((p, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${i === idx ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}
              style={{ borderColor: i === idx ? 'var(--text-1)' : 'transparent' }}
            >
              {isVideoUrl(p.url) ? (
                <div
                  className="w-full h-full flex items-center justify-center text-lg th-text-1"
                  style={{ background: 'var(--bg-elevated)' }}
                >
                  ▶
                </div>
              ) : (
                <img src={p.url} alt="" className="w-full h-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Main component ─────────────────────────────────────────── */

export default function VillaDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const [villa, setVilla] = useState<Villa | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [reservation, setReservation] = useState({
    logement_id: '', tarif_id: '', date_debut: '', date_fin: '', nb_personnes: '1',
  })
  const [resError, setResError] = useState('')
  const [resSuccess, setResSuccess] = useState(false)
  const [resLoading, setResLoading] = useState(false)
  const [avisForm, setAvisForm] = useState({ note: '5', commentaire: '' })
  const [avisSuccess, setAvisSuccess] = useState(false)
  const [isFavori, setIsFavori] = useState(false)

  useEffect(() => {
    api.get(`/villas/${id}`)
      .then((res) => setVilla(res.data))
      .finally(() => setIsLoading(false))
  }, [id])

  useEffect(() => {
    if (user?.role === 'client' && id) {
      api.get('/favoris').then((res) => {
        setIsFavori(res.data.some((f: any) => f.villa_id === parseInt(id)))
      }).catch(() => {})
    }
  }, [user, id])

  const toggleFavori = async () => {
    if (!user || user.role !== 'client') return
    if (isFavori) {
      await api.delete(`/villas/${id}/favoris`)
      setIsFavori(false)
    } else {
      await api.post(`/villas/${id}/favoris`, {})
      setIsFavori(true)
    }
  }

  const logementSelectionne = villa?.logements.find((l) => l.id === parseInt(reservation.logement_id))

  const handleReservation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) { navigate('/login'); return }
    setResError('')
    setResLoading(true)
    try {
      await api.post('/reservations', {
        logement_id: parseInt(reservation.logement_id),
        tarif_id: parseInt(reservation.tarif_id),
        date_debut: reservation.date_debut,
        date_fin: reservation.date_fin,
        nb_personnes: parseInt(reservation.nb_personnes),
      })
      setResSuccess(true)
    } catch (err: any) {
      const errors = err.response?.data?.errors
      const first = errors ? Object.values(errors).flat()[0] as string : null
      setResError(first || err.response?.data?.message || 'Une erreur est survenue.')
    } finally {
      setResLoading(false)
    }
  }

  const handleAvis = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) { navigate('/login'); return }
    await api.post('/avis', {
      villa_id: parseInt(id!),
      note: parseInt(avisForm.note),
      commentaire: avisForm.commentaire,
    })
    setAvisSuccess(true)
    api.get(`/villas/${id}`).then((res) => setVilla(res.data))
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  const openLightbox = (i: number) => setLightboxIdx(i)
  const closeLightbox = () => setLightboxIdx(null)
  const prevPhoto = () => setLightboxIdx((i) => i !== null ? (i - 1 + (villa?.photos.length ?? 1)) % (villa?.photos.length ?? 1) : 0)
  const nextPhoto = () => setLightboxIdx((i) => i !== null ? (i + 1) % (villa?.photos.length ?? 1) : 0)

  if (isLoading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-1)' }}>
      <PageHeader />
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '2px solid var(--border)', borderTopColor: 'var(--text-1)' }} />
          <p className="text-sm th-text-2">Chargement...</p>
        </div>
      </div>
    </div>
  )

  if (!villa) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-1)' }}>
      <PageHeader />
      <div className="flex items-center justify-center py-32 flex-col gap-3">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-elevated)' }}>
          <svg className="w-8 h-8" style={{ color: 'var(--text-3)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
        </div>
        <p className="th-text-2">Villa introuvable.</p>
      </div>
    </div>
  )

  const noteAvg = villa.avis.length
    ? (villa.avis.reduce((s, a) => s + a.note, 0) / villa.avis.length).toFixed(1)
    : null

  const dateInputClass = `w-full rounded-xl px-4 py-2.5 text-sm th-input-field${isDark ? ' [color-scheme:dark]' : ''}`

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-1)' }}>
      <ReadingProgress />
      <PageHeader />

      {lightboxIdx !== null && (
        <Lightbox
          photos={villa.photos}
          idx={lightboxIdx}
          onClose={closeLightbox}
          onPrev={prevPhoto}
          onNext={nextPhoto}
        />
      )}

      {/* Mobile floating button — clients uniquement */}
      {(!user || user.role === 'client') && (
        <div
          className="lg:hidden fixed bottom-0 left-0 right-0 z-30 backdrop-blur-md px-6 py-4"
          style={{ background: 'var(--header-bg)', borderTop: '1px solid var(--border)' }}
        >
          <button
            onClick={() => document.getElementById('reservation-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="w-full py-3 rounded-xl text-sm font-medium transition-all hover:scale-[1.02]"
            style={{ background: 'var(--text-1)', color: 'var(--bg)' }}
          >
            Réserver
          </button>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-6 py-8 md:py-10 pb-28 lg:pb-10">
        <PhotoGallery photos={villa.photos} onLightbox={openLightbox} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Left — Info */}
          <div className="lg:col-span-2">
            <div className="flex items-start justify-between mb-2 gap-4">
              <h1 className="text-2xl md:text-3xl font-normal leading-tight">{villa.nom}</h1>
              <div className="shrink-0 flex items-center gap-2">
                {user?.role === 'client' && (
                  <button
                    onClick={toggleFavori}
                    className="w-8 h-8 flex items-center justify-center rounded-xl transition-all hover:scale-110 active:scale-95"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      color: isFavori ? '#ef4444' : 'var(--text-3)',
                    }}
                    aria-label={isFavori ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  >
                    <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill={isFavori ? '#ef4444' : 'none'} stroke={isFavori ? '#ef4444' : 'currentColor'} strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                    </svg>
                  </button>
                )}
                {noteAvg && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-amber-400">★</span>
                    <span className="th-text-1 font-medium">{noteAvg}</span>
                    <span className="th-text-3 text-sm">({villa.avis.length})</span>
                  </div>
                )}
              </div>
            </div>
            <p className="th-text-2 mb-4">{villa.adresse}, {villa.ville}</p>

            {/* Contact propriétaire */}
            <div
              className="rounded-xl px-4 py-3 mb-6 flex flex-wrap items-center gap-x-5 gap-y-2"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              <span className="text-sm th-text-2">
                Propriétaire : <span className="th-text-1 font-medium">{villa.proprietaire.name}</span>
              </span>
              <a
                href={`tel:${villa.telephone}`}
                className="flex items-center gap-1.5 text-sm font-medium th-text-1 transition-opacity hover:opacity-70"
              >
                📞 {villa.telephone}
              </a>
            </div>

            <p className="th-text-2 leading-relaxed mb-10">{villa.description}</p>

            {/* Map */}
            {villa.latitude && villa.longitude && (
              <div className="mb-10">
                <h2 className="text-lg font-medium mb-4">Localisation</h2>
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  <iframe
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${villa.longitude - 0.01}%2C${villa.latitude - 0.01}%2C${villa.longitude + 0.01}%2C${villa.latitude + 0.01}&layer=mapnik&marker=${villa.latitude}%2C${villa.longitude}`}
                    width="100%"
                    height="280"
                    style={{ border: 0, display: 'block' }}
                    loading="lazy"
                    title="Localisation de la villa"
                  />
                </div>
              </div>
            )}

            {/* Logements */}
            <h2 className="text-lg font-medium mb-4">Logements disponibles</h2>
            <div className="flex flex-col gap-3 mb-10">
              {villa.logements.map((l) => (
                <div
                  key={l.id}
                  className={`rounded-xl px-5 py-4 transition-opacity ${!l.disponible ? 'opacity-60' : ''}`}
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <p className="font-medium th-text-1">
                      {l.nom}
                      <span className="th-text-2 font-normal text-sm ml-2">
                        · {typeLabels[l.type]} · {l.capacite} pers.
                      </span>
                    </p>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${
                      l.disponible
                        ? 'bg-green-500/10 border-green-500/20 text-green-600'
                        : 'bg-red-500/10 border-red-500/20 text-red-500'
                    }`}>
                      {l.disponible ? 'Disponible' : 'Indisponible'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {l.tarifs.map((t) => (
                      <span
                        key={t.id}
                        className="text-xs px-3 py-1 rounded-full th-text-2"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                      >
                        {tarifLabels[t.type_tarif]}
                        {t.avec_clim ? ' + clim' : ''}
                        {t.avec_buffet ? ' + buffet' : ''}
                        {' '}— {t.prix.toLocaleString('fr-FR')} FCFA
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Avis */}
            <h2 className="text-lg font-medium mb-4">
              Avis{villa.avis.length > 0 && <span className="th-text-3 font-normal ml-2">({villa.avis.length})</span>}
            </h2>
            {villa.avis.length === 0 ? (
              <p className="th-text-3 text-sm mb-8">Aucun avis pour l'instant.</p>
            ) : (
              <div className="flex flex-col gap-3 mb-8">
                {villa.avis.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-xl px-5 py-4"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium th-text-1">{a.client.name}</p>
                      <StarRating note={a.note} />
                    </div>
                    {a.commentaire && <p className="text-sm th-text-2 leading-relaxed">{a.commentaire}</p>}
                    <p className="text-xs th-text-3 mt-2">{fmt(a.created_at)}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Formulaire avis — clients uniquement */}
            {user && user.role === 'client' && !avisSuccess && (
              <form
                onSubmit={handleAvis}
                className="rounded-xl p-5"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
              >
                <h3 className="text-sm font-medium mb-4 th-text-1">Laisser un avis</h3>
                <div className="flex items-center gap-3 mb-4">
                  <label className="text-sm th-text-2 shrink-0">Note</label>
                  <select
                    value={avisForm.note}
                    onChange={(e) => setAvisForm({ ...avisForm, note: e.target.value })}
                    className="rounded-lg px-3 py-1.5 text-sm th-input-field"
                  >
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n} style={{ background: 'var(--bg)' }}>
                        {'★'.repeat(n)} ({n}/5)
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={avisForm.commentaire}
                  onChange={(e) => setAvisForm({ ...avisForm, commentaire: e.target.value })}
                  rows={3}
                  placeholder="Votre commentaire..."
                  className="w-full rounded-lg px-4 py-2.5 text-sm th-input-field resize-none mb-4"
                />
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
                  style={{ background: 'var(--text-1)', color: 'var(--bg)' }}
                >
                  Publier
                </button>
              </form>
            )}
            {avisSuccess && (
              <div className="bg-green-500/10 border border-green-500/20 text-green-600 rounded-xl px-5 py-4 text-sm">
                Merci pour votre avis !
              </div>
            )}
          </div>

          {/* Right — Réservation */}
          <div className="lg:col-span-1" id="reservation-form">
            <div
              className="rounded-2xl p-6 sticky top-20"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              <h2 className="text-lg font-medium mb-5">Réserver</h2>

              {user && user.role !== 'client' ? (
                <div className="text-center py-6">
                  <p className="th-text-3 text-sm">
                    {user.role === 'proprietaire'
                      ? 'Aperçu de votre villa telle que vue par les clients.'
                      : 'Les réservations sont réservées aux clients.'}
                  </p>
                </div>
              ) : resSuccess ? (
                <div className="text-center py-6">
                  <p className="text-2xl mb-3">✅</p>
                  <p className="text-green-600 font-medium mb-2">Réservation envoyée !</p>
                  <p className="th-text-2 text-sm">Le propriétaire va confirmer sous peu.</p>
                </div>
              ) : (
                <form onSubmit={handleReservation} className="flex flex-col gap-4">
                  {resError && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl px-4 py-3 text-sm">
                      {resError}
                    </div>
                  )}

                  <div>
                    <label className="text-xs th-text-2 mb-1.5 block">Logement</label>
                    <select
                      required
                      value={reservation.logement_id}
                      onChange={(e) => setReservation({ ...reservation, logement_id: e.target.value, tarif_id: '' })}
                      className="w-full rounded-xl px-4 py-2.5 text-sm th-input-field"
                    >
                      <option value="" style={{ background: 'var(--bg)' }}>Choisir un logement</option>
                      {villa.logements.filter((l) => l.disponible).map((l) => (
                        <option key={l.id} value={l.id} style={{ background: 'var(--bg)' }}>{l.nom}</option>
                      ))}
                    </select>
                  </div>

                  {logementSelectionne && (
                    <div>
                      <label className="text-xs th-text-2 mb-1.5 block">Formule</label>
                      <select
                        required
                        value={reservation.tarif_id}
                        onChange={(e) => setReservation({ ...reservation, tarif_id: e.target.value })}
                        className="w-full rounded-xl px-4 py-2.5 text-sm th-input-field"
                      >
                        <option value="" style={{ background: 'var(--bg)' }}>Choisir un tarif</option>
                        {logementSelectionne.tarifs.map((t) => (
                          <option key={t.id} value={t.id} style={{ background: 'var(--bg)' }}>
                            {tarifLabels[t.type_tarif]}
                            {t.avec_clim ? ' + clim' : ''}
                            {t.avec_buffet ? ' + buffet' : ''}
                            {' '}— {t.prix.toLocaleString('fr-FR')} FCFA
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="text-xs th-text-2 mb-1.5 block">Arrivée</label>
                    <input
                      type="date"
                      required
                      value={reservation.date_debut}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setReservation({ ...reservation, date_debut: e.target.value })}
                      className={dateInputClass}
                    />
                  </div>
                  <div>
                    <label className="text-xs th-text-2 mb-1.5 block">Départ</label>
                    <input
                      type="date"
                      required
                      value={reservation.date_fin}
                      min={reservation.date_debut || new Date().toISOString().split('T')[0]}
                      onChange={(e) => setReservation({ ...reservation, date_fin: e.target.value })}
                      className={dateInputClass}
                    />
                  </div>
                  <div>
                    <label className="text-xs th-text-2 mb-1.5 block">Nombre de personnes</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={reservation.nb_personnes}
                      onChange={(e) => setReservation({ ...reservation, nb_personnes: e.target.value })}
                      className="w-full rounded-xl px-4 py-2.5 text-sm th-input-field"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={resLoading}
                    className="py-3 rounded-xl text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50 mt-1"
                    style={{ background: 'var(--text-1)', color: 'var(--bg)' }}
                  >
                    {resLoading ? 'Envoi...' : user ? 'Réserver' : 'Connexion pour réserver'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
