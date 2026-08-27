import { useState } from 'react'
import {
  ScrollText, CheckCircle2, XCircle, Star, StarOff, UserX, MessageSquareX,
} from 'lucide-react'
import api from '../../services/api'
import { useRequete } from '../../lib/useRequete'
import { depuis } from '../../lib/format'
import Pagination from '../../components/console/Pagination'
import ListeConsole from '../../components/console/ListeConsole'
import { versPage, type Page } from '../../lib/page'

interface Trace {
  id: number
  user_id: number | null
  auteur_nom: string
  auteur_email: string
  action: string
  cible_type: string | null
  cible_id: number | null
  cible_libelle: string | null
  details: Record<string, unknown> | null
  ip: string | null
  created_at: string
}

/**
 * Chaque action consignée porte son verbe, son icône et son ton. Un journal
 * où « validée » et « supprimé » se ressemblent ne se balaie pas : on cherche
 * en général une décision précise, pas la liste.
 */
const ACTIONS: Record<string, { libelle: string; Icone: typeof CheckCircle2; ton: string }> = {
  'villa.validee': { libelle: 'Annonce validée', Icone: CheckCircle2, ton: 'var(--success)' },
  'villa.rejetee': { libelle: 'Annonce rejetée', Icone: XCircle, ton: 'var(--danger)' },
  'villa.mise_en_vedette': { libelle: 'Mise en vedette', Icone: Star, ton: 'var(--gold)' },
  'villa.retiree_vedette': { libelle: 'Retirée de la vedette', Icone: StarOff, ton: 'var(--text-3)' },
  'compte.supprime': { libelle: 'Compte supprimé', Icone: UserX, ton: 'var(--danger)' },
  'avis.supprime': { libelle: 'Avis supprimé', Icone: MessageSquareX, ton: 'var(--danger)' },
}

const FILTRES = [
  { valeur: '', label: 'Tout' },
  { valeur: 'villa.validee', label: 'Validations' },
  { valeur: 'villa.rejetee', label: 'Rejets' },
  { valeur: 'compte.supprime', label: 'Comptes' },
  { valeur: 'avis.supprime', label: 'Avis' },
]

/** Le contexte utile, en une ligne. Un objet JSON brut ne se lit pas. */
function detailLisible(t: Trace): string | null {
  const d = t.details
  if (!d) return null

  if (typeof d.statut_avant === 'string' && typeof d.statut_apres === 'string') {
    return `${d.statut_avant} → ${d.statut_apres}`
  }
  if (typeof d.email === 'string') {
    return `${d.email}${typeof d.role === 'string' ? ` · ${d.role}` : ''}`
  }
  if (typeof d.note === 'number') {
    return `note ${d.note}/5`
  }
  return null
}

export default function AdminJournal() {
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)

  const requete = `page=${page}${action ? `&action=${action}` : ''}`

  const { donnees, chargement, erreur, reessayer } = useRequete<Page<Trace> | Trace[]>(
    async (signal) => (await api.get(`/admin/journal?${requete}`, { signal })).data,
    requete,
    { messageErreurParDefaut: 'Impossible de charger le journal.' }
  )

  const page_ = versPage(donnees)
  const traces = page_?.data ?? []

  return (
    <div>
      <ListeConsole
        titre="Journal"
        sousTitre={<>
          Qui a validé, rejeté ou supprimé quoi, et quand. Devant un propriétaire qui
          conteste un refus, c'est la seule chose à produire.
        </>}
        chargement={chargement}
        erreur={erreur}
        reessayer={reessayer}
        vide={traces.length === 0}
        videIcone={ScrollText}
        squelette={5}
        videTexte={action
          ? 'Aucune action de ce type pour l’instant.'
          : <>Aucune action consignée. Le journal se remplit dès qu'une annonce est
             validée, un avis ou un compte supprimé.</>}
        outils={<div className="console-filtres">
        <div className="console-onglets" role="tablist">
          {FILTRES.map((f) => (
            <button
              key={f.valeur || 'tout'}
              role="tab"
              aria-selected={action === f.valeur}
              onClick={() => { setAction(f.valeur); setPage(1) }}
              className={`console-onglet${action === f.valeur ? ' est-actif' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>}
      >
        <div className="tableau-cadre">
          <table className="tableau">
            <thead>
              <tr>
                <th scope="col">Action</th>
                <th scope="col">Cible</th>
                <th scope="col">Auteur</th>
                <th scope="col">Quand</th>
              </tr>
            </thead>
            <tbody>
              {traces.map((t) => {
                const a = ACTIONS[t.action] ?? { libelle: t.action, Icone: ScrollText, ton: 'var(--text-2)' }
                const detail = detailLisible(t)

                return (
                  <tr key={t.id}>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: a.ton, fontWeight: 500 }}>
                        <a.Icone size={15} aria-hidden="true" />
                        {a.libelle}
                      </span>
                    </td>
                    <td className="col-souple">
                      <p style={{ margin: 0, color: 'var(--text-1)' }}>
                        {t.cible_libelle ?? <span style={{ color: 'var(--text-3)' }}>—</span>}
                      </p>
                      {detail && (
                        <p style={{ margin: 0, font: 'var(--t-caption)', color: 'var(--text-3)' }}>{detail}</p>
                      )}
                    </td>
                    <td>
                      <p style={{ margin: 0, color: 'var(--text-1)' }}>
                        {t.auteur_nom}
                        {/* Le compte a été supprimé depuis : la trace lui
                            survit, c'est tout l'intérêt d'avoir recopié le nom. */}
                        {t.user_id === null && (
                          <span style={{ color: 'var(--text-3)', fontWeight: 400 }}> · compte supprimé</span>
                        )}
                      </p>
                      <p style={{ margin: 0, font: 'var(--t-caption)', color: 'var(--text-3)' }}>{t.auteur_email}</p>
                    </td>
                    <td style={{ color: 'var(--text-3)' }}>
                      <time dateTime={t.created_at} title={new Date(t.created_at).toLocaleString('fr-FR')}>
                        {depuis(t.created_at)}
                      </time>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <Pagination page={page_} onChange={setPage} unite="action" />
      </ListeConsole>
    </div>
  )
}
