import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useConfig } from '../../context/ConfigContext'

interface Reservation {
  id: number
  date_debut: string
  date_fin: string
  nb_personnes: number
  montant_total: number
  statut: 'en_attente' | 'confirmee' | 'annulee'
  client?: { name: string; email: string }
  logement: { nom: string; villa: { nom: string } }
  tarif: { type_tarif: string }
  paiement?: {
    statut: 'en_attente' | 'reussi' | 'echoue'
    reference: string | null
    paye_le: string | null
  } | null
}

const tarifLabels: Record<string, string> = {
  journee: 'Journée', nuitee: 'Nuitée', demi_journee: 'Demi-journée', pass: 'Pass',
}

const statutConfig: Record<Reservation['statut'], { label: string; badge: string; border: string }> = {
  en_attente: {
    label: 'En attente',
    badge: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    border: '#FBBF24',
  },
  confirmee: {
    label: 'Confirmée',
    badge: 'text-green-400 bg-green-400/10 border-green-400/20',
    border: '#4ADE80',
  },
  annulee: {
    label: 'Annulée',
    badge: 'text-red-400 bg-red-400/10 border-red-400/20',
    border: '#F87171',
  },
}

function nightsLabel(debut: string, fin: string) {
  const diff = Math.round((new Date(fin).getTime() - new Date(debut).getTime()) / 86400000)
  if (diff === 0) return '1 jour'
  return `${diff} nuit${diff > 1 ? 's' : ''}`
}

/**
 * Une réservation reste à régler tant qu'elle n'est pas annulée et qu'aucun
 * paiement n'a abouti. C'est ici que le client revient : le tunnel n'était
 * atteignable que dans les secondes suivant la demande, sur la fiche de la
 * villa — passé cet écran, plus aucun chemin n'y menait.
 */
function resteARegler(r: Reservation, minimum: number) {
  return r.statut !== 'annulee'
    && r.paiement?.statut !== 'reussi'
    // Sous le plancher du prestataire, proposer « Régler » enverrait droit dans
    // un refus : mieux vaut ne rien proposer que promettre l'impossible.
    && r.montant_total >= minimum
}

export default function Reservations() {
  const { user } = useAuth()
  const { paiement } = useConfig()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchReservations = () => {
    api.get('/reservations')
      .then((res) => {
        const order = { en_attente: 0, confirmee: 1, annulee: 2 }
        const sorted = (res.data as Reservation[]).sort((a, b) => order[a.statut] - order[b.statut])
        setReservations(sorted)
      })
      .finally(() => setIsLoading(false))
  }

  useEffect(() => { fetchReservations() }, [])

  const updateStatut = async (id: number, statut: 'confirmee' | 'annulee') => {
    await api.patch(`/reservations/${id}/statut`, { statut })
    fetchReservations()
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  if (isLoading) return (
    <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-3)' }}>
      <div className="w-4 h-4 rounded-full animate-spin" style={{ border: '2px solid var(--border)', borderTopColor: 'var(--text-1)' }} />
      Chargement...
    </div>
  )

  const pendingCount = reservations.filter((r) => r.statut === 'en_attente').length

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-normal">Réservations</h1>
          {pendingCount > 0 && user?.role === 'proprietaire' && (
            <p className="text-sm mt-1 text-yellow-400">
              {pendingCount} demande{pendingCount > 1 ? 's' : ''} en attente
            </p>
          )}
        </div>
        <span className="text-sm" style={{ color: 'var(--text-3)' }}>
          {reservations.length} au total
        </span>
      </div>

      {reservations.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        >
          <p className="text-3xl mb-3">📭</p>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>Aucune réservation pour le moment.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {reservations.map((r) => {
            const config = statutConfig[r.statut]
            return (
              <div
                key={r.id}
                className="rounded-2xl px-6 py-5"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderLeft: `3px solid ${config.border}`,
                }}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{r.logement.villa.nom}</p>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>
                      {r.logement.nom} · {tarifLabels[r.tarif.type_tarif] ?? r.tarif.type_tarif}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs border px-2.5 py-1 rounded-full ${config.badge}`}>
                    {config.label}
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-3" style={{ color: 'var(--text-3)' }}>
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    {fmt(r.date_debut)} → {fmt(r.date_fin)}
                  </span>
                  <span>{nightsLabel(r.date_debut, r.date_fin)}</span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    {r.nb_personnes} pers.
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  {r.client ? (
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                      {r.client.name} · {r.client.email}
                    </p>
                  ) : <span />}
                  <p className="text-sm font-medium flex items-center gap-2">
                    {/* Le propriétaire doit voir aussi vite que le client si
                        l'argent est arrivé : c'est ce qui décide s'il remet
                        les clés. */}
                    {r.paiement?.statut === 'reussi' && (
                      <span className="text-xs font-normal" style={{ color: 'var(--success)' }}>
                        ✓ Payé
                      </span>
                    )}
                    {r.montant_total.toLocaleString('fr-FR')} FCFA
                  </p>
                </div>

                {user?.role === 'proprietaire' && r.statut === 'en_attente' && (
                  <div
                    className="flex gap-3 mt-4 pt-4"
                    style={{ borderTop: '1px solid var(--border)' }}
                  >
                    <button
                      onClick={() => updateStatut(r.id, 'confirmee')}
                      className="flex-1 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-90"
                      style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                    >
                      ✓ Confirmer
                    </button>
                    <button
                      onClick={() => updateStatut(r.id, 'annulee')}
                      className="flex-1 py-2 rounded-xl text-sm transition-all th-text-2 hover:th-text-1"
                      style={{ border: '1px solid var(--border)' }}
                    >
                      Refuser
                    </button>
                  </div>
                )}

                {user?.role === 'client' && (paiement.actif ? resteARegler(r, paiement.montant_minimum) : r.statut === 'en_attente') && (
                  <div
                    className="flex flex-wrap items-center justify-end gap-3 mt-4 pt-4"
                    style={{ borderTop: '1px solid var(--border)' }}
                  >
                    {r.statut === 'en_attente' && (
                      <button
                        onClick={() => updateStatut(r.id, 'annulee')}
                        className="px-4 py-1.5 rounded-xl text-sm transition-all th-text-2 hover:th-text-1"
                        style={{ border: '1px solid var(--border)', minHeight: 44 }}
                      >
                        Annuler la demande
                      </button>
                    )}

                    {paiement.actif && resteARegler(r, paiement.montant_minimum) && (
                      <Link
                        to={`/reservation/${r.id}/paiement`}
                        className="btn btn-primaire btn-sm"
                      >
                        {r.paiement?.statut === 'en_attente' ? 'Reprendre le paiement' : 'Régler'}
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
