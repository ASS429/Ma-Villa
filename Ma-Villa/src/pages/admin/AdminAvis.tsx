import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Trash2, MessageSquare, ExternalLink } from 'lucide-react'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { useRequete } from '../../lib/useRequete'
import { messageErreur } from '../../lib/erreurs'
import { depuis } from '../../lib/format'
import ConfirmModal from '../../components/ConfirmModal'
import Button from '../../components/ui/Button'
import Pagination, { type Page } from '../../components/console/Pagination'

interface Avis {
  id: number
  note: number
  commentaire: string | null
  client: { name: string } | null
  villa: { id: number; nom: string } | null
  created_at: string
}

function Etoiles({ note }: { note: number }) {
  return (
    <span aria-label={`${note} sur 5`} style={{ whiteSpace: 'nowrap' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= note ? 'etoile' : 'etoile-vide'} aria-hidden="true">★</span>
      ))}
    </span>
  )
}

export default function AdminAvis() {
  const toast = useToast()
  const [page, setPage] = useState(1)
  const [aSupprimer, setASupprimer] = useState<Avis | null>(null)

  const { donnees, chargement, erreur, reessayer } = useRequete<Page<Avis>>(
    async (signal) => (await api.get(`/admin/avis?page=${page}`, { signal })).data,
    `avis-${page}`,
    { messageErreurParDefaut: 'Impossible de charger les avis.' }
  )

  const avis = donnees?.data ?? []

  const supprimer = async (a: Avis) => {
    try {
      await api.delete(`/admin/avis/${a.id}`)
      toast.succes('Avis supprimé.')
      reessayer()
    } catch (err) {
      toast.erreur(messageErreur(err, "L'avis n'a pas pu être supprimé."))
    } finally {
      setASupprimer(null)
    }
  }

  return (
    <div>
      {aSupprimer && (
        <ConfirmModal
          message="Supprimer cet avis ?"
          detail={
            "L'avis disparaîtra de la fiche de la villa et la note moyenne sera recalculée. "
            + 'Seul un client ayant réellement séjourné a pu le déposer : ne le retirer que pour un abus.'
          }
          confirmLabel="Supprimer"
          danger
          onConfirm={() => supprimer(aSupprimer)}
          onCancel={() => setASupprimer(null)}
        />
      )}

      <h1 className="console-titre">Avis</h1>
      <p className="console-sous-titre">
        {donnees ? `${donnees.total} avis déposé${donnees.total > 1 ? 's' : ''}` : 'Modération des avis'}
        {' — '}seuls les clients ayant séjourné peuvent en écrire un.
      </p>

      {erreur && !chargement && (
        <div className="console-erreur" role="alert">
          {erreur}
          <Button variante="secondaire" taille="sm" onClick={reessayer} >Réessayer</Button>
        </div>
      )}

      {chargement ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {[1, 2, 3].map((n) => (
            <div key={n} className="panneau">
              <div className="skeleton" style={{ height: 14, width: '30%', borderRadius: 6, marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 12, width: '70%', borderRadius: 6 }} />
            </div>
          ))}
        </div>
      ) : avis.length === 0 ? (
        <div className="console-vide">
          <span className="console-vide-icone"><MessageSquare size={22} /></span>
          <p>Aucun avis déposé pour l'instant.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {avis.map((a) => (
            <article key={a.id} className="panneau">
              <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 4 }}>
                    <Etoiles note={a.note} />
                    <span style={{ font: 'var(--t-body-sm)', fontWeight: 600, color: 'var(--text-1)' }}>
                      {a.client?.name ?? 'Compte supprimé'}
                    </span>
                    <span style={{ font: 'var(--t-caption)', color: 'var(--text-3)' }}>{depuis(a.created_at)}</span>
                  </div>

                  {a.villa && (
                    <Link
                      to={`/villas/${a.villa.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        font: 'var(--t-caption)', color: 'var(--accent)', textDecoration: 'none',
                      }}
                    >
                      {a.villa.nom} <ExternalLink size={12} />
                    </Link>
                  )}

                  {a.commentaire && (
                    <p style={{ margin: 'var(--space-3) 0 0', font: 'var(--t-body-sm)', color: 'var(--text-2)', lineHeight: 1.6 }}>
                      {a.commentaire}
                    </p>
                  )}
                </div>

                <Button
                  variante="discret"
                  taille="sm"
                  onClick={() => setASupprimer(a)}
                  iconeAvant={<Trash2 size={15} />}
                  aria-label="Supprimer cet avis"
                />
              </div>
            </article>
          ))}
        </div>
      )}

      <Pagination page={donnees} onChange={setPage} unite="avis" />
    </div>
  )
}
