import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { messageErreur } from '../../lib/erreurs'
import { aujourdhui, dateCourte, periode } from '../../lib/format'

interface Plage { id: number; date_debut: string; date_fin: string; disponible: boolean; motif?: string | null }

const VIDE = { debut: '', fin: '', motif: '' }

/** « Du 10 au 13 nov. 2026 », ou « Le 10 nov. 2026 » pour un seul jour. */
function libellePlage(p: Plage): string {
  const debut = p.date_debut.slice(0, 10)
  const fin = p.date_fin.slice(0, 10)
  return debut === fin ? `Le ${dateCourte(debut)}` : `Du ${periode(debut, fin).replace(' – ', ' au ')}`
}

/**
 * Les dates qu'un propriétaire ferme lui-même, logement par logement.
 *
 * Il loue souvent aussi ailleurs — Airbnb, bouche-à-oreille. Sans cet écran,
 * rien ne l'empêchait d'être réservé deux fois le même soir : l'API existait
 * depuis le début, mais aucun écran ne s'en servait.
 *
 * Les deux bornes sont incluses, comme pour une réservation : fermer du 10 au
 * 13, c'est n'accepter personne qui arrive, dort ou part ces jours-là.
 */
export default function DatesFermees({ logementId }: { logementId: number }) {
  const [plages, setPlages] = useState<Plage[]>([])
  const [formulaire, setFormulaire] = useState<typeof VIDE | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState('')
  const [alerte, setAlerte] = useState('')

  const charger = useCallback(() => {
    api.get<Plage[]>(`/logements/${logementId}/disponibilites`)
      .then(({ data }) => {
        // Une plage passée ne ferme plus rien, et une plage ouverte n'a jamais
        // rien fermé : ni l'une ni l'autre n'a sa place dans la liste.
        const jour = aujourdhui()
        setPlages(data.filter((p) => !p.disponible && p.date_fin.slice(0, 10) >= jour))
      })
      .catch(() => {})
  }, [logementId])

  useEffect(() => { charger() }, [charger])

  const fermer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formulaire) return
    setEnvoi(true)
    setErreur('')
    try {
      const { data } = await api.post(`/logements/${logementId}/disponibilites`, {
        date_debut: formulaire.debut,
        date_fin: formulaire.fin,
        disponible: false,
        motif: formulaire.motif.trim() || null,
      })
      setAlerte(data.reservations_concernees > 0
        ? (data.reservations_concernees > 1
          ? 'Des réservations tombent déjà dans ces dates. Fermer ne les annule pas.'
          : 'Une réservation tombe déjà dans ces dates. Fermer ne l’annule pas.')
        : '')
      setFormulaire(null)
      charger()
    } catch (err) {
      setErreur(messageErreur(err, 'Ces dates n’ont pas pu être fermées.'))
    } finally {
      setEnvoi(false)
    }
  }

  const rouvrir = async (plage: Plage) => {
    setErreur('')
    try {
      await api.delete(`/logements/${logementId}/disponibilites/${plage.id}`)
      setAlerte('')
      charger()
    } catch (err) {
      setErreur(messageErreur(err, 'Ces dates n’ont pas pu être rouvertes.'))
    }
  }

  const jour = aujourdhui()

  return (
    <div className="mt-4 pt-4 flex flex-col gap-2" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-medium">Dates fermées</p>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            {plages.length === 0
              ? 'Aucune : le logement se réserve tous les jours.'
              : 'Personne ne peut réserver ces jours-là.'}
          </p>
        </div>
        {!formulaire && (
          <button
            onClick={() => { setFormulaire(VIDE); setErreur(''); setAlerte('') }}
            className="text-xs px-3 py-1.5 rounded-xl transition-all hover:opacity-80"
            style={{ border: '1px solid var(--border)', color: 'var(--text-2)' }}
          >
            Fermer des dates
          </button>
        )}
      </div>

      {plages.map((p) => (
        <div
          key={p.id}
          className="flex items-center justify-between gap-3 text-sm rounded-xl px-4 py-2.5"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
        >
          <span style={{ color: 'var(--text-2)' }}>
            {libellePlage(p)}
            {p.motif && <span className="block text-xs" style={{ color: 'var(--text-3)' }}>{p.motif}</span>}
          </span>
          <button
            onClick={() => rouvrir(p)}
            className="text-xs shrink-0 transition-colors hover:opacity-70"
            style={{ color: 'var(--text-3)' }}
          >
            Rouvrir
          </button>
        </div>
      ))}

      {formulaire && (
        <form
          onSubmit={fermer}
          className="rounded-xl p-4 flex flex-col gap-3"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`fermer-debut-${logementId}`} className="text-xs mb-1 block" style={{ color: 'var(--text-3)' }}>Du</label>
              <input
                id={`fermer-debut-${logementId}`} type="date" required min={jour} value={formulaire.debut}
                onChange={(e) => setFormulaire({
                  ...formulaire,
                  debut: e.target.value,
                  // Une fin antérieure au nouveau début suit le début.
                  fin: formulaire.fin && formulaire.fin < e.target.value ? e.target.value : formulaire.fin,
                })}
                className="w-full rounded-lg px-3 py-2 text-sm th-input-field"
              />
            </div>
            <div>
              <label htmlFor={`fermer-fin-${logementId}`} className="text-xs mb-1 block" style={{ color: 'var(--text-3)' }}>Au (inclus)</label>
              <input
                id={`fermer-fin-${logementId}`} type="date" required min={formulaire.debut || jour} value={formulaire.fin}
                onChange={(e) => setFormulaire({ ...formulaire, fin: e.target.value })}
                className="w-full rounded-lg px-3 py-2 text-sm th-input-field"
              />
            </div>
          </div>
          <div>
            <label htmlFor={`fermer-motif-${logementId}`} className="text-xs mb-1 block" style={{ color: 'var(--text-3)' }}>
              Note pour vous (facultatif)
            </label>
            <input
              id={`fermer-motif-${logementId}`} maxLength={255} value={formulaire.motif}
              onChange={(e) => setFormulaire({ ...formulaire, motif: e.target.value })}
              placeholder="Loué ailleurs, travaux, famille…"
              className="w-full rounded-lg px-3 py-2 text-sm th-input-field"
            />
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>Les clients ne la voient pas.</p>
          </div>
          {erreur && <p className="text-xs" role="alert" style={{ color: 'var(--danger)' }}>{erreur}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setFormulaire(null)}
              className="flex-1 py-2 rounded-xl text-xs transition-all hover:opacity-80"
              style={{ border: '1px solid var(--border)', color: 'var(--text-2)' }}>
              Annuler
            </button>
            <button type="submit" disabled={envoi}
              className="flex-1 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
              {envoi ? 'Fermeture…' : 'Fermer ces dates'}
            </button>
          </div>
        </form>
      )}

      {!formulaire && erreur && <p className="text-xs" role="alert" style={{ color: 'var(--danger)' }}>{erreur}</p>}
      {alerte && (
        <p className="text-xs" role="status" style={{ color: 'var(--warning)' }}>
          {alerte}{' '}
          <Link to="/dashboard/reservations" className="underline underline-offset-2">Voir mes réservations</Link>
        </p>
      )}
    </div>
  )
}
