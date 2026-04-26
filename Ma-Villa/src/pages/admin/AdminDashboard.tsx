import { useEffect, useState } from 'react'
import api from '../../services/api'
import { Users, Building2, Clock, CalendarDays, DollarSign, type LucideIcon } from 'lucide-react'

interface Stats {
  utilisateurs: number
  villas_total: number
  villas_attente: number
  reservations: number
  revenus: number
}

function StatCard({
  Icon,
  label,
  value,
  urgent,
  delta,
}: {
  Icon: LucideIcon
  label: string
  value: string | number
  urgent?: boolean
  delta?: number
}) {
  return (
    <div
      className={`rounded-2xl p-6 transition-all hover:-translate-y-1 hover:shadow-lg ${urgent ? 'card-urgent' : ''}`}
      style={{
        background: 'var(--bg-elevated)',
        border: `1px solid ${urgent ? 'rgba(251,191,36,0.3)' : 'var(--border)'}`,
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: urgent ? 'rgba(251,191,36,0.15)' : 'var(--accent-bg)' }}
        >
          <Icon size={18} style={{ color: urgent ? 'var(--warning)' : 'var(--accent)' }} />
        </div>
        {delta !== undefined && (
          <span className="text-xs font-medium" style={{ color: delta >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p
        className="text-xs uppercase tracking-widest font-semibold mb-1"
        style={{ color: urgent ? 'var(--warning)' : 'var(--text-3)' }}
      >
        {label}
      </p>
      <p
        className="stat-value text-4xl"
        style={{ color: urgent && Number(value) > 0 ? 'var(--warning)' : 'var(--text-1)' }}
      >
        {value}
      </p>
    </div>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    api.get('/admin/stats').then((res) => setStats(res.data)).catch(() => {})
  }, [])

  return (
    <div>
      <h1 className="text-3xl font-light mb-1" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", letterSpacing: '-0.03em' }}>Tableau de bord</h1>
      <p className="text-sm mb-8" style={{ color: 'var(--text-3)' }}>Vue d'ensemble de la plateforme</p>

      {!stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-2xl p-6" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
              <div className="skeleton w-10 h-10 rounded-xl mb-4" />
              <div className="skeleton h-3 w-24 rounded mb-2" />
              <div className="skeleton h-9 w-16 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard Icon={Users}        label="Utilisateurs"           value={stats.utilisateurs} />
          <StatCard Icon={Building2}    label="Villas total"           value={stats.villas_total} />
          <StatCard
            Icon={Clock}
            label="En attente validation"
            value={stats.villas_attente}
            urgent={stats.villas_attente > 0}
          />
          <StatCard Icon={CalendarDays} label="Réservations"           value={stats.reservations} />
          <StatCard
            Icon={DollarSign}
            label="Revenus confirmés"
            value={`${stats.revenus.toLocaleString('fr-FR')} FCFA`}
          />
        </div>
      )}
    </div>
  )
}
