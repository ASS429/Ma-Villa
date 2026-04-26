import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import {
  CalendarDays, Heart, Waves, Home, Clock, Plus, Building2, type LucideIcon,
} from 'lucide-react'

function StatCard({ Icon, label, value, urgent }: { Icon: LucideIcon; label: string; value: number | string; urgent?: boolean }) {
  return (
    <div
      className={`rounded-2xl p-6 transition-all hover:-translate-y-0.5 ${urgent ? 'card-urgent' : ''}`}
      style={{
        background: 'var(--bg-elevated)',
        border: `1px solid ${urgent ? 'rgba(251,191,36,0.3)' : 'var(--border)'}`,
      }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
        style={{ background: urgent ? 'rgba(251,191,36,0.15)' : 'var(--accent-bg)' }}
      >
        <Icon size={16} style={{ color: urgent ? 'var(--warning)' : 'var(--accent)' }} />
      </div>
      <p className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: urgent ? 'var(--warning)' : 'var(--text-3)' }}>{label}</p>
      <p className="stat-value text-4xl" style={{ color: urgent ? 'var(--warning)' : 'var(--text-1)' }}>{value}</p>
    </div>
  )
}

function ActionCard({ to, Icon, label, sub }: { to: string; Icon: LucideIcon; label: string; sub: string }) {
  return (
    <Link
      to={to}
      className="rounded-2xl p-5 flex items-center gap-4 group transition-all hover:-translate-y-0.5"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'var(--accent-bg)' }}
      >
        <Icon size={16} style={{ color: 'var(--accent)' }} />
      </div>
      <div className="flex-1">
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{sub}</p>
      </div>
      <span className="text-sm group-hover:translate-x-0.5 transition-transform" style={{ color: 'var(--text-3)' }}>→</span>
    </Link>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ reservations: 0, villas: 0, favoris: 0, enAttente: 0 })

  useEffect(() => {
    if (user?.role === 'client') {
      api.get('/reservations').then((res) => {
        setStats((s) => ({ ...s, reservations: res.data.length }))
      }).catch(() => {})
      api.get('/favoris').then((res) => {
        setStats((s) => ({ ...s, favoris: res.data.length }))
      }).catch(() => {})
    }
    if (user?.role === 'proprietaire') {
      api.get('/proprietaire/villas').then((res) => {
        setStats((s) => ({ ...s, villas: res.data.length }))
      }).catch(() => {})
      api.get('/reservations').then((res) => {
        const pending = (res.data as any[]).filter((r) => r.statut === 'en_attente').length
        setStats((s) => ({ ...s, reservations: res.data.length, enAttente: pending }))
      }).catch(() => {})
    }
  }, [user])

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-2xl md:text-3xl font-light mb-1" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", letterSpacing: '-0.03em' }}>
          Bonjour, {user?.name}
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-2)' }}>
          {user?.role === 'proprietaire'
            ? 'Espace propriétaire — gérez vos villas et réservations.'
            : 'Espace client — retrouvez vos réservations.'}
        </p>
      </div>

      {/* Client */}
      {user?.role === 'client' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <StatCard Icon={CalendarDays} label="Mes réservations" value={stats.reservations} />
            <Link
              to="/dashboard/favoris"
              className="rounded-2xl p-6 flex flex-col justify-between group transition-all hover:-translate-y-0.5"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: 'var(--accent-bg)' }}
              >
                <Heart size={16} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: 'var(--text-3)' }}>Favoris</p>
                <p className="text-sm font-medium">
                  {stats.favoris} villa{stats.favoris !== 1 ? 's' : ''}{' '}
                  <span className="group-hover:translate-x-0.5 inline-block transition-transform">→</span>
                </p>
              </div>
            </Link>
            <Link
              to="/villas"
              className="rounded-2xl p-6 flex flex-col justify-between group transition-all hover:-translate-y-0.5"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: 'var(--accent-bg)' }}
              >
                <Waves size={16} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: 'var(--text-3)' }}>Explorer</p>
                <p className="text-sm font-medium">
                  Voir les villas{' '}
                  <span className="group-hover:translate-x-0.5 inline-block transition-transform">→</span>
                </p>
              </div>
            </Link>
          </div>

          <div
            className="rounded-2xl p-6"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
          >
            <p className="text-sm font-medium mb-5">Comment ça marche ?</p>
            <ol className="flex flex-col gap-3.5">
              {[
                'Parcourez les villas disponibles',
                'Sélectionnez un logement et une formule tarifaire',
                'Envoyez une demande de réservation',
                'Le propriétaire confirme ou refuse sous 24h',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm" style={{ color: 'var(--text-2)' }}>
                  <span
                    className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold mt-0.5"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
                  >
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </>
      )}

      {/* Propriétaire */}
      {user?.role === 'proprietaire' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <StatCard Icon={Home} label="Mes villas" value={stats.villas} />
            <StatCard
              Icon={Clock}
              label="En attente"
              value={stats.enAttente}
              urgent={stats.enAttente > 0}
            />
            <Link
              to="/dashboard/villas/nouvelle"
              className="rounded-2xl p-6 flex flex-col justify-between group transition-all hover:-translate-y-0.5"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: 'var(--accent-bg)' }}
              >
                <Plus size={16} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: 'var(--text-3)' }}>Créer</p>
                <p className="text-sm font-medium">
                  Nouvelle villa{' '}
                  <span className="group-hover:translate-x-0.5 inline-block transition-transform">→</span>
                </p>
              </div>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ActionCard
              to="/dashboard/villas"
              Icon={Building2}
              label="Gérer mes villas"
              sub="Logements, tarifs, photos"
            />
            <ActionCard
              to="/dashboard/reservations"
              Icon={CalendarDays}
              label="Réservations clients"
              sub="Confirmer ou refuser les demandes"
            />
          </div>
        </>
      )}
    </div>
  )
}
