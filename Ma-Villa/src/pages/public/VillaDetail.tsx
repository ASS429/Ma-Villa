import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useToast } from '../../context/ToastContext'
import { useConfig } from '../../context/ConfigContext'
import PageHeader from '../../components/PageHeader'
import Footer from '../../components/Footer'
import Seo from '../../components/Seo'
import MoyensPaiement from '../../components/MoyensPaiement'
import ContactReservation from '../../components/ContactReservation'
import { GrilleTarifaire, ParcoursReservation } from '../../components/BlocTarifaire'
import { useRequete } from '../../lib/useRequete'
import { messageErreur } from '../../lib/erreurs'
import NotFound from '../NotFound'
import { fcfa, dateCourte, noteLisible, aujourdhui, ajouterJours } from '../../lib/format'
import { prixSejour } from '../../lib/prix'
import { type Occupation, type VillaDetail as Villa } from '../../types'
import { lieu } from '../../lib/lieu'
import { useLangue } from '../../i18n/langue'
import { TEXTES_HEBERGEMENT } from '../../i18n/hebergement'
import { modeReservation } from '../../lib/ouverture'

/* ─── Utilitaires ────────────────────────────────────────────── */

function estVideo(url: string) {
  return /\.(mp4|webm|mov)(\?.*)?$/i.test(url)
}


/** Une date tombe-t-elle dans une plage déjà prise ? */
function chevauche(
  debut: string, fin: string,
  plages: { date_debut: string; date_fin: string }[]
) {
  return plages.some((p) => p.date_debut <= fin && p.date_fin >= debut)
}

/* ─── Barre de progression de lecture ────────────────────────── */

function ProgressionLecture() {
  const [progression, setProgression] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement
      const total = el.scrollHeight - el.clientHeight
      setProgression(total > 0 ? (el.scrollTop / total) * 100 : 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-0.5" style={{ background: 'var(--border)' }} aria-hidden="true">
      <div className="h-full" style={{ width: `${progression}%`, background: 'var(--accent)', transition: 'width 60ms linear' }} />
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
    // La page derrière ne doit pas défiler pendant la visionneuse.
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose, onPrev, onNext])

  const courante = photos[idx]
  const t = TEXTES_HEBERGEMENT[useLangue().langue].fiche

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.96)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t.photoSur(idx + 1, photos.length)}
    >
      <button onClick={onClose} className="absolute top-4 right-5 text-white/60 hover:text-white text-4xl leading-none" aria-label={t.fermer}>×</button>

      {photos.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); onPrev() }} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-5xl px-2" aria-label={t.photoPrecedente}>‹</button>
          <button onClick={(e) => { e.stopPropagation(); onNext() }} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-5xl px-2" aria-label={t.photoSuivante}>›</button>
        </>
      )}

      <div className="max-w-5xl w-full px-4 md:px-16 flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        {estVideo(courante.url) ? (
          <video src={courante.url} className="max-h-[85vh] w-full object-contain" controls autoPlay loop muted playsInline />
        ) : (
          <img src={courante.url} alt={courante.alt} className="max-h-[85vh] max-w-full object-contain rounded-xl" />
        )}
        <p className="text-white/40 text-xs mt-3">{idx + 1} / {photos.length}</p>
      </div>
    </div>
  )
}

/* ─── Galerie ────────────────────────────────────────────────── */

function Galerie({ photos, onAgrandir }: {
  photos: { url: string; alt: string }[]
  onAgrandir: (i: number) => void
}) {
  const [idx, setIdx] = useState(0)
  const t = TEXTES_HEBERGEMENT[useLangue().langue].fiche

  if (photos.length === 0) {
    return (
      <div className="aspect-video rounded-2xl flex items-center justify-center mb-8 th-card">
        <p className="th-text-3 text-sm">{t.aucunePhoto}</p>
      </div>
    )
  }

  const courante = photos[idx]
  const video = estVideo(courante.url)

  return (
    <div className="mb-8">
      <div className="relative aspect-video rounded-2xl overflow-hidden mb-3 group" style={{ background: 'var(--bg-elevated)' }}>
        {video ? (
          <video key={courante.url} src={courante.url} className="w-full h-full object-cover" controls autoPlay loop muted playsInline />
        ) : (
          <img
            src={courante.url}
            alt={courante.alt || t.photo(idx + 1)}
            className="w-full h-full object-cover cursor-zoom-in"
            onClick={() => onAgrandir(idx)}
            fetchPriority="high"
            decoding="async"
          />
        )}

        {photos.length > 1 && (
          <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-sm">
            {idx + 1} / {photos.length}
          </div>
        )}
      </div>

      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {photos.map((p, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${i === idx ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}
              style={{ borderColor: i === idx ? 'var(--accent)' : 'transparent' }}
              aria-label={t.voirPhoto(i + 1)}
              aria-current={i === idx}
            >
              {estVideo(p.url) ? (
                <span className="w-full h-full flex items-center justify-center text-lg th-text-1" style={{ background: 'var(--bg-elevated)' }}>▶</span>
              ) : (
                <img src={p.url} alt="" loading="lazy" className="w-full h-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Étoiles ────────────────────────────────────────────────── */

function Etoiles({ note }: { note: number }) {
  const t = TEXTES_HEBERGEMENT[useLangue().langue].fiche
  return (
    <span className="flex gap-0.5" aria-label={t.surCinq(note)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} aria-hidden="true" style={{ color: i <= note ? 'var(--accent-gold)' : 'var(--border-2)' }}>★</span>
      ))}
    </span>
  )
}

/* ─── Page ───────────────────────────────────────────────────── */

export default function VillaDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { isDark } = useTheme()
  const toast = useToast()
  const { paiement, reservations } = useConfig()
  const navigate = useNavigate()
  const { langue, lien } = useLangue()
  const t = TEXTES_HEBERGEMENT[langue].fiche

  const { donnees: villa, chargement, erreur, statut, reessayer } = useRequete<Villa>(
    async (signal) => (await api.get(`/villas/${id}`, { signal })).data,
    `villa-${id}`,
    { messageErreurParDefaut: t.chargementImpossible }
  )
  // En ligne, auprès de l'équipe (annonce des associés) ou suspendue.
  const mode = modeReservation(reservations, villa ?? undefined)

  // « Donner votre avis » arrive avec #avis. La section n'existe qu'une fois
  // l'annonce chargée, et le routeur ne défile pas vers une ancre.
  const { hash } = useLocation()
  useEffect(() => {
    if (!villa || !hash) return
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'start' })
  }, [villa, hash])

  const [occupation, setOccupation] = useState<Occupation>({})
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [estFavori, setEstFavori] = useState(false)
  const [peutNoter, setPeutNoter] = useState(false)

  const [reservation, setReservation] = useState({
    logement_id: '', tarif_id: '', date_debut: '', date_fin: '', nb_personnes: '1',
  })
  const [erreurResa, setErreurResa] = useState('')
  const [resaEnvoyee, setResaEnvoyee] = useState(false)
  const [reservationCreee, setReservationCreee] = useState<number | null>(null)
  const [envoiResa, setEnvoiResa] = useState(false)

  const [avisForm, setAvisForm] = useState({ note: '5', commentaire: '' })
  const [avisEnvoye, setAvisEnvoye] = useState(false)

  // Dates déjà prises : le client les voyait seulement après un refus en 409.
  useEffect(() => {
    if (!id) return
    api.get(`/villas/${id}/occupation`)
      .then((res) => setOccupation(res.data))
      .catch(() => { /* sans calendrier, le serveur reste l'arbitre à la soumission */ })
  }, [id])

  useEffect(() => {
    if (user?.role !== 'client' || !id) return
    api.get('/favoris')
      .then((res) => setEstFavori(res.data.some((f: { villa_id: number }) => f.villa_id === Number(id))))
      .catch(() => {})
    api.get(`/villas/${id}/avis/eligibilite`)
      .then((res) => setPeutNoter(Boolean(res.data.peut_noter)))
      .catch(() => setPeutNoter(false))
  }, [user, id])

  // Un seul logement réservable, une seule formule : rien à choisir, donc rien
  // à oublier — ils valent choix. Le client remplissait ses dates, demandait à
  // réserver, et n'apprenait qu'alors qu'il fallait cliquer plus haut.
  const reservables = villa?.logements.filter((l) => l.disponible && l.tarifs.length > 0) ?? []
  const logement = villa?.logements.find((l) => l.id === Number(reservation.logement_id))
    ?? (reservables.length === 1 ? reservables[0] : undefined)
  const tarif = logement?.tarifs.find((t) => t.id === Number(reservation.tarif_id))
    ?? (logement?.tarifs.length === 1 ? logement.tarifs[0] : undefined)

  // Récapitulatif de prix : le client validait sans jamais voir le total. Même
  // calcul que le serveur, prix de la semaine ou du mois compris.
  const recapitulatif = tarif && reservation.date_debut && reservation.date_fin
    ? prixSejour(tarif, reservation.date_debut, reservation.date_fin)
    : null

  // Le séjour le plus court accepté, à la nuitée seulement.
  const nuitsMinimum = tarif?.type_tarif === 'nuitee' ? Math.max(logement?.nuits_minimum ?? 1, 1) : 1
  const tropCourt = recapitulatif !== null && tarif?.type_tarif === 'nuitee' && recapitulatif.unites < nuitsMinimum
  const departAuPlusTot = reservation.date_debut && nuitsMinimum > 1
    ? ajouterJours(reservation.date_debut, nuitsMinimum)
    : reservation.date_debut

  const plagesPrises = logement ? (occupation[String(logement.id)] ?? []) : []
  const conflitDates =
    reservation.date_debut && reservation.date_fin
      ? chevauche(reservation.date_debut, reservation.date_fin, plagesPrises)
      : false

  const toggleFavori = async () => {
    if (!user || user.role !== 'client') return
    const etait = estFavori
    setEstFavori(!etait)
    try {
      if (etait) await api.delete(`/villas/${id}/favoris`)
      else await api.post(`/villas/${id}/favoris`, {})
    } catch (err) {
      setEstFavori(etait)
      toast.erreur(messageErreur(err, t.favorisImpossible))
    }
  }

  const partager = async () => {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: villa?.nom, text: `${villa?.nom} — ${villa?.ville}`, url })
      } else {
        await navigator.clipboard.writeText(url)
        toast.succes(t.lienCopie)
      }
    } catch { /* partage annulé par l'utilisateur */ }
  }

  const envoyerReservation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) { navigate(`${lien('/login')}?retour=${encodeURIComponent(lien(`/hebergements/${id}/`))}`); return }

    setErreurResa('')

    // Sans logement ni formule choisis, la demande partait avec des zéros et
    // revenait en « Le champ logement id sélectionné est invalide ».
    if (!logement || !tarif) {
      setErreurResa(logement ? t.choisirFormule : t.choisirLogement)
      return
    }
    if (conflitDates) {
      setErreurResa(t.dejaPris)
      return
    }
    if (tropCourt) {
      setErreurResa(t.tropCourt(nuitsMinimum))
      return
    }
    if (logement && Number(reservation.nb_personnes) > logement.capacite) {
      setErreurResa(t.capaciteMax(logement.capacite))
      return
    }

    setEnvoiResa(true)
    try {
      const { data: creee } = await api.post('/reservations', {
        logement_id: logement.id,
        tarif_id: tarif.id,
        date_debut: reservation.date_debut,
        date_fin: reservation.date_fin,
        nb_personnes: Number(reservation.nb_personnes),
      })
      setReservationCreee(creee?.id ?? null)
      setResaEnvoyee(true)
      toast.succes(t.demandeEnvoyeeToast)
    } catch (err) {
      setErreurResa(messageErreur(err))
    } finally {
      setEnvoiResa(false)
    }
  }

  const envoyerAvis = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/avis', {
        villa_id: Number(id),
        note: Number(avisForm.note),
        commentaire: avisForm.commentaire,
      })
      setAvisEnvoye(true)
      toast.succes(t.merciAvis)
      reessayer()
    } catch (err) {
      toast.erreur(messageErreur(err, t.avisImpossible))
    }
  }

  /* ── États de page ── */

  if (chargement) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-1)' }}>
        <PageHeader />
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="skeleton aspect-video rounded-2xl mb-8" />
          <div className="skeleton h-8 w-2/3 rounded-lg mb-3" />
          <div className="skeleton h-4 w-1/3 rounded-lg" />
        </div>
      </div>
    )
  }

  /*
   * L'annonce n'existe pas — le cas le plus fréquent, et de loin.
   *
   * La plupart des visiteurs arrivent ici par un lien WhatsApp vers une villa
   * que le propriétaire a retirée. Leur proposer « Réessayer » est une
   * impasse : la villa ne reviendra pas. On sert donc la page de rattrapage,
   * qui lit la ville dans l'adresse morte et propose des villas semblables.
   *
   * Un 500 ou un réseau coupé restent traités plus bas : là, réessayer a un
   * sens, et renvoyer le visiteur ailleurs lui ferait perdre une annonce qui
   * existe pourtant.
   */
  if (statut === 404) {
    return <NotFound />
  }

  if (erreur || !villa) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-1)' }}>
        <Seo titre={t.indisponibleSeo} description={t.indisponibleSeoDescription} indexable={false} />
        <PageHeader />
        <div className="flex flex-col items-center justify-center py-32 gap-4 px-6 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-elevated)' }}>
            <svg className="w-8 h-8" style={{ color: 'var(--text-3)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
            </svg>
          </div>
          <p className="th-text-1 font-medium">{t.indisponible}</p>
          <p className="th-text-2 text-sm max-w-sm">{erreur || t.peutEtreRetiree}</p>
          <div className="flex gap-3 mt-2">
            <button onClick={reessayer} className="px-5 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-90" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
              {t.reessayer}
            </button>
            <Link to={lien('/hebergements/')} className="px-5 py-2.5 rounded-xl text-sm font-medium th-text-1" style={{ border: '1px solid var(--border-2)', textDecoration: 'none' }}>
              {t.voirLesVillas}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const note = noteLisible(villa.note_moyenne)
  const classeDate = `w-full rounded-xl px-4 py-2.5 text-sm th-input-field${isDark ? ' [color-scheme:dark]' : ''}`
  const photoPartage = villa.photos.find((p) => !estVideo(p.url))?.url

  const descriptionSeo = [
    t.seoA(villa.nom, villa.ville),
    villa.prix_min != null ? t.seoAPartirDe(fcfa(villa.prix_min)) : null,
    note ? t.seoNote(note, villa.avis_count ?? 0) : null,
    (villa.description ?? '').slice(0, 100),
  ].filter(Boolean).join(' ')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-1)' }}>
      {/* `chemin` déclarait `/villas/${villa.id}/`, l'ancienne route : elle
          **redirige**. La fiche annonçait donc à Google une adresse de
          référence qui n'existe que pour mener ailleurs, en écrasant au rendu
          la bonne canonique écrite par le pré-rendu. */}
      <Seo
        titre={`${villa.nom} — ${villa.ville}`}
        description={descriptionSeo}
        image={photoPartage}
        chemin={lien(`/hebergements/${villa.id}/`)}
        donneesStructurees={{
          '@context': 'https://schema.org',
          '@type': 'LodgingBusiness',
          name: villa.nom,
          description: villa.description,
          address: { '@type': 'PostalAddress', streetAddress: villa.adresse, addressLocality: villa.ville, addressCountry: 'SN' },
          image: villa.photos.filter((p) => !estVideo(p.url)).map((p) => p.url),
          // Google ne reçoit pas une position approchée comme des coordonnées.
          ...(villa.latitude && villa.longitude && !villa.position_approximative
            ? { geo: { '@type': 'GeoCoordinates', latitude: villa.latitude, longitude: villa.longitude } }
            : {}),
          ...(villa.prix_min != null
            ? { priceRange: t.seoAPartirDe(fcfa(villa.prix_min)).replace(/\.$/, '') }
            : {}),
          ...(note && villa.avis_count
            ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: note, reviewCount: villa.avis_count, bestRating: 5 } }
            : {}),
        }}
      />

      <ProgressionLecture />
      <PageHeader />

      {lightboxIdx !== null && (
        <Lightbox
          photos={villa.photos}
          idx={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onPrev={() => setLightboxIdx((i) => ((i ?? 0) - 1 + villa.photos.length) % villa.photos.length)}
          onNext={() => setLightboxIdx((i) => ((i ?? 0) + 1) % villa.photos.length)}
        />
      )}

      {/* Barre d'action mobile */}
      {(!user || user.role === 'client') && !resaEnvoyee && (
        <div
          className="barre-action-fiche lg:hidden fixed left-0 right-0 z-30 backdrop-blur-md px-5 py-3 flex items-center gap-4"
          style={{ background: 'var(--header-bg)', borderTop: '1px solid var(--border)' }}
        >
          <div className="flex-1 min-w-0">
            {villa.prix_min != null ? (
              <p className="text-sm th-text-1"><span className="font-semibold">{fcfa(villa.prix_min)}</span></p>
            ) : (
              <p className="text-sm th-text-2">{TEXTES_HEBERGEMENT[langue].carte.surDemande}</p>
            )}
            <p className="text-xs th-text-3">{t.aPartirDe}</p>
          </div>
          <button
            onClick={() => document.getElementById('reserver')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="px-6 py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)', minHeight: 44 }}
          >
            {mode === 'en_ligne' ? t.reserver : t.contacter}
          </button>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-6 py-8 md:py-10 pb-28 lg:pb-10">
        <Galerie photos={villa.photos} onAgrandir={setLightboxIdx} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Colonne gauche */}
          <div className="lg:col-span-2">
            <div className="flex items-start justify-between mb-2 gap-4">
              <h1 className="text-2xl md:text-3xl font-normal leading-tight">{villa.nom}</h1>
              <div className="shrink-0 flex items-center gap-2">
                <button
                  onClick={partager}
                  className="w-9 h-9 flex items-center justify-center rounded-xl transition-all hover:scale-110"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
                  aria-label={t.partager}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342a3 3 0 100-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684zm0-12a3 3 0 105.368-2.684 3 3 0 00-5.368 2.684z" />
                  </svg>
                </button>

                {user?.role === 'client' && (
                  <button
                    onClick={toggleFavori}
                    className="w-9 h-9 flex items-center justify-center rounded-xl transition-all hover:scale-110"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      color: estFavori ? '#ef4444' : 'var(--text-3)',
                    }}
                    aria-label={estFavori ? t.retirerFavori : t.ajouterFavori}
                    aria-pressed={estFavori}
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill={estFavori ? '#ef4444' : 'none'} stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-5">
              {/* Le quartier s'intercale quand il existe : c'est la précision
                  que le propriétaire avait écrite dans la ville, et qu'on lui
                  a rendue en la rangeant ailleurs.

                  `lieu()` et non une concaténation : les propriétaires écrivent
                  la même chose dans plusieurs champs, et la ligne donnait
                  « Thies, Thies, Thiès ». */}
              <p className="th-text-2">
                {lieu(villa.adresse, villa.quartier, villa.ville)}
              </p>
              {note && (
                <span className="flex items-center gap-1.5 text-sm">
                  <span style={{ color: 'var(--accent-gold)' }}>★</span>
                  <span className="th-text-1 font-medium">{note}</span>
                  <span className="th-text-3">({t.avis(villa.avis_count ?? 0)})</span>
                </span>
              )}
            </div>

            {/* Le numéro du propriétaire n'est plus affiché ici. Publié, il
                permettait de convenir d'un séjour hors plateforme : la
                commission s'évaporait, et la réservation n'étant plus tracée,
                le client perdait avis vérifié, preuve de paiement et recours.
                Les questions passent désormais par la messagerie, et les
                coordonnées sont échangées une fois la réservation confirmée. */}
            <div className="rounded-xl px-4 py-3 mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 th-card">
              <span className="text-sm th-text-2">
                {t.proprietaire} <span className="th-text-1 font-medium">{villa.proprietaire.name}</span>
              </span>
              <span className="text-sm th-text-3">
                {{ en_ligne: t.ecrire, equipe: t.ecrireEquipe, suspendue: t.ecrireFerme }[mode]}
              </span>
            </div>

            <p className="th-text-2 leading-relaxed mb-10 whitespace-pre-line">{villa.description}</p>

            {villa.latitude && villa.longitude && (
              <section className="mb-10">
                <h2 className="text-lg font-medium mb-4">{t.localisation}</h2>
                {/* Une position approchée (centre du quartier) n'a pas de
                    marqueur : il désignerait une maison qui n'est pas la bonne. */}
                {villa.position_approximative && (
                  <p className="text-sm th-text-2 mb-3">{t.localisationApprochee([villa.quartier, villa.ville].filter(Boolean).join(", "))}</p>
                )}
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  <iframe
                    src={villa.position_approximative
                      ? `https://www.openstreetmap.org/export/embed.html?bbox=${villa.longitude - 0.025}%2C${villa.latitude - 0.02}%2C${villa.longitude + 0.025}%2C${villa.latitude + 0.02}&layer=mapnik`
                      : `https://www.openstreetmap.org/export/embed.html?bbox=${villa.longitude - 0.01}%2C${villa.latitude - 0.01}%2C${villa.longitude + 0.01}%2C${villa.latitude + 0.01}&layer=mapnik&marker=${villa.latitude}%2C${villa.longitude}`}
                    width="100%" height="280" style={{ border: 0, display: 'block' }}
                    loading="lazy" title={t.localisationDe(villa.nom)}
                  />
                </div>
              </section>
            )}

            {/* Logements et tarifs — approche B : la grille, pour comparer.
                Cliquer un prix renseigne le panneau de réservation (approche A). */}
            <section className="mb-10">
              <h2 className="text-lg font-medium mb-2">{t.logementsTarifs}</h2>
              <p className="text-sm th-text-2 mb-4">
                {t.selectionnez}
              </p>
              <GrilleTarifaire
                logements={villa.logements}
                tarifChoisi={tarif?.id ?? null}
                onChoisir={(l, t) => {
                  setReservation((r) => ({
                    ...r,
                    logement_id: String(l.id),
                    tarif_id: String(t.id),
                    nb_personnes: Math.min(Number(r.nb_personnes) || 1, l.capacite).toString(),
                  }))
                  document.getElementById('reserver')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
              />
            </section>

            {/* Avis */}
            {/* `#avis` : « Donner votre avis » y mène depuis Mes réservations. */}
            <section id="avis" style={{ scrollMarginTop: 96 }}>
              <h2 className="text-lg font-medium mb-4">
                {t.titreAvis}{villa.avis.length > 0 && <span className="th-text-3 font-normal ml-2">({villa.avis.length})</span>}
              </h2>

              {villa.avis.length === 0 ? (
                <p className="th-text-3 text-sm mb-8">{t.aucunAvis}</p>
              ) : (
                <div className="flex flex-col gap-3 mb-8">
                  {villa.avis.map((a) => (
                    <div key={a.id} className="rounded-xl px-5 py-4 th-card">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium th-text-1">{a.client.name}</p>
                        <Etoiles note={a.note} />
                      </div>
                      {a.commentaire && <p className="text-sm th-text-2 leading-relaxed">{a.commentaire}</p>}
                      <p className="text-xs th-text-3 mt-2">{dateCourte(a.created_at, langue)}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Le formulaire n'apparaît qu'aux clients ayant réellement séjourné. */}
              {peutNoter && !avisEnvoye && (
                <form onSubmit={envoyerAvis} className="rounded-xl p-5 th-card">
                  <h3 className="text-sm font-medium mb-4 th-text-1">{t.laisserAvis}</h3>
                  <div className="flex items-center gap-3 mb-4">
                    <label htmlFor="avis-note" className="text-sm th-text-2 shrink-0">{t.note}</label>
                    <select
                      id="avis-note"
                      value={avisForm.note}
                      onChange={(e) => setAvisForm({ ...avisForm, note: e.target.value })}
                      className="rounded-lg px-3 py-1.5 text-sm th-input-field"
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>{'★'.repeat(n)} ({n}/5)</option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    value={avisForm.commentaire}
                    onChange={(e) => setAvisForm({ ...avisForm, commentaire: e.target.value })}
                    rows={3}
                    maxLength={1000}
                    placeholder={t.commentaire}
                    aria-label={t.commentaireLibelle}
                    className="w-full rounded-lg px-4 py-2.5 text-sm th-input-field resize-none mb-4"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
                    style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                  >
                    {t.publier}
                  </button>
                </form>
              )}

              {user?.role === 'client' && !peutNoter && !avisEnvoye && (
                <p className="text-sm th-text-3">
                  {t.avisReserves}
                </p>
              )}
            </section>
          </div>

          {/* Colonne droite — réservation */}
          <div className="lg:col-span-1" id="reserver">
            <div className="rounded-2xl p-6 sticky top-20" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
              {villa.prix_min != null && (
                <p className="mb-5 th-text-1">
                  {/* L'ordre suit la langue : « 45 000 FCFA à partir de » se lit
                      en français, « from 45 000 FCFA » en anglais. */}
                  {langue === 'en' && <span className="text-sm th-text-3">{t.aPartirDe} </span>}
                  <span className="text-2xl font-semibold">{fcfa(villa.prix_min)}</span>
                  {langue === 'fr' && <span className="text-sm th-text-3"> {t.aPartirDe}</span>}
                </p>
              )}

              <h2 className="text-lg font-medium mb-5">{t.reserver}</h2>

              {user && user.role !== 'client' ? (
                <p className="th-text-3 text-sm text-center py-6">
                  {user.role === 'proprietaire'
                    ? t.apercuProprietaire
                    : t.reserveesAuxClients}
                </p>
              ) : mode !== 'en_ligne' ? (
                // Suspendue, ou annonce des associés : un humain à joindre à la
                // place du formulaire, que le serveur refuserait de toute façon.
                // Les prix restent affichés au-dessus — ils servent toujours à
                // choisir.
                <ContactReservation
                  hebergement={villa.nom}
                  equipe={mode === 'equipe'}
                />
              ) : resaEnvoyee ? (
                <div className="text-center py-6">
                  <p className="text-2xl mb-3" aria-hidden="true">✅</p>
                  <p className="font-medium mb-2" style={{ color: 'var(--success)' }}>{t.demandeEnvoyee}</p>
                  {paiement.actif && reservationCreee ? (
                    <>
                      <p className="th-text-2 text-sm mb-5">
                        {t.reglezMaintenant}
                      </p>
                      <Link
                        to={lien(`/reservation/${reservationCreee}/paiement`)}
                        className="btn btn-primaire btn-md w-full justify-center"
                      >
                        {t.payer(fcfa(recapitulatif?.montant ?? 0))}
                      </Link>
                      <Link to="/dashboard/reservations" className="text-sm th-text-2 underline underline-offset-4 mt-4 inline-block">
                        {t.payerPlusTard}
                      </Link>
                    </>
                  ) : (
                    <>
                      <p className="th-text-2 text-sm mb-5">
                        {t.proprietaireVaConfirmer}
                      </p>
                      <Link to="/dashboard/reservations" className="text-sm th-text-1 underline underline-offset-4">
                        {t.suivreDemande}
                      </Link>
                    </>
                  )}
                </div>
              ) : (
                <form onSubmit={envoyerReservation} className="flex flex-col gap-4">
                  {erreurResa && (
                    <div
                      className="rounded-xl px-4 py-3 text-sm"
                      style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.22)', color: 'var(--danger)' }}
                      role="alert"
                    >
                      {erreurResa}
                    </div>
                  )}

                  {/* Approche A : un choix par étape, formules impossibles
                      barrées. Les deux menus déroulants précédents obligeaient
                      à ouvrir la liste pour découvrir ce qui existait. */}
                  <ParcoursReservation
                    logements={villa.logements}
                    logementChoisi={logement ?? null}
                    tarifChoisi={tarif ?? null}
                    onChoisirLogement={(l) => setReservation((r) => ({
                      ...r,
                      logement_id: String(l.id),
                      tarif_id: '',
                      nb_personnes: Math.min(Number(r.nb_personnes) || 1, l.capacite).toString(),
                    }))}
                    onChoisirTarif={(t) => setReservation((r) => ({ ...r, tarif_id: String(t.id) }))}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="r-debut" className="text-xs th-text-2 mb-1.5 block">{t.arrivee}</label>
                      <input
                        id="r-debut" type="date" required
                        min={aujourdhui()}
                        value={reservation.date_debut}
                        onChange={(e) => setReservation({ ...reservation, date_debut: e.target.value, date_fin: '' })}
                        className={classeDate}
                      />
                    </div>
                    <div>
                      <label htmlFor="r-fin" className="text-xs th-text-2 mb-1.5 block">{t.depart}</label>
                      <input
                        id="r-fin" type="date" required
                        min={departAuPlusTot || aujourdhui()}
                        value={reservation.date_fin}
                        onChange={(e) => setReservation({ ...reservation, date_fin: e.target.value })}
                        className={classeDate}
                      />
                    </div>
                  </div>

                  {/* Périodes déjà prises, connues avant de soumettre */}
                  {logement && plagesPrises.length > 0 && (
                    <div className="text-xs th-text-3 leading-relaxed">
                      <p className="th-text-2 mb-1">{t.dejaReserve}</p>
                      <ul className="flex flex-wrap gap-x-3 gap-y-0.5">
                        {plagesPrises.slice(0, 6).map((p, i) => (
                          <li key={i}>{dateCourte(p.date_debut, langue)} → {dateCourte(p.date_fin, langue)}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {conflitDates && (
                    <p className="text-xs" style={{ color: 'var(--danger)' }} role="alert">
                      {t.chevauche}
                    </p>
                  )}

                  {nuitsMinimum > 1 && (
                    <p className="text-xs" style={{ color: tropCourt ? 'var(--danger)' : 'var(--text-3)' }} role={tropCourt ? 'alert' : undefined}>
                      {t.minimumNuits(nuitsMinimum)}
                    </p>
                  )}

                  <div>
                    <label htmlFor="r-personnes" className="text-xs th-text-2 mb-1.5 block">
                      {t.nbPersonnes}{logement ? t.max(logement.capacite) : ''}
                    </label>
                    <input
                      id="r-personnes" type="number" required
                      min={1} max={logement?.capacite}
                      value={reservation.nb_personnes}
                      onChange={(e) => setReservation({ ...reservation, nb_personnes: e.target.value })}
                      className="w-full rounded-xl px-4 py-2.5 text-sm th-input-field"
                    />
                  </div>

                  {/* Total calculé avant validation */}
                  {recapitulatif && tarif && (
                    <div className="rounded-xl px-4 py-3 flex flex-col gap-1.5 text-sm" style={{ background: 'var(--bg-elevated)' }}>
                      <div className="flex justify-between gap-3 th-text-2">
                        <span>
                          {recapitulatif.prixApplique === 'semaine'
                            ? t.prixSemaine(recapitulatif.unites)
                            : recapitulatif.prixApplique === 'mois'
                              ? t.prixMois(recapitulatif.unites)
                              : `${fcfa(tarif.prix)} × ${tarif.type_tarif === 'nuitee' ? t.nuits(recapitulatif.unites) : t.jours(recapitulatif.unites)}`}
                        </span>
                        <span className="text-right">
                          {fcfa(recapitulatif.montant)}
                          {recapitulatif.prixApplique !== 'unite' && (
                            <span className="block text-xs th-text-3 line-through">{t.auLieuDe(fcfa(recapitulatif.sansReduction))}</span>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between font-semibold th-text-1 pt-1.5" style={{ borderTop: '1px solid var(--border)' }}>
                        <span>{t.total}</span>
                        <span>{fcfa(recapitulatif.montant)}</span>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={envoiResa || conflitDates || tropCourt}
                    className="py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ background: 'var(--accent)', color: 'var(--on-accent)', minHeight: 44 }}
                  >
                    {envoiResa ? t.envoi : user ? t.demanderAReserver : t.seConnecter}
                  </button>

                  <MoyensPaiement plateforme={villa.encaisse_par_la_plateforme} />

                  <p className="text-xs th-text-3 text-center leading-relaxed">
                    {t.rienMaintenant}{' '}
                    <Link to={lien('/annulation/')} className="underline underline-offset-2">{t.politiqueAnnulation}</Link>.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
