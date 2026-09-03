import { useEffect, useState } from 'react'
import { Search, Trash2, Users, ShieldCheck } from 'lucide-react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useRequete } from '../../lib/useRequete'
import { messageErreur } from '../../lib/erreurs'
import { dateCourte } from '../../lib/format'
import ConfirmModal from '../../components/ConfirmModal'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Pagination from '../../components/console/Pagination'
import ListeConsole from '../../components/console/ListeConsole'
import { versPage, type Page } from '../../lib/page'

interface Utilisateur {
  id: number
  name: string
  email: string
  role: string
  phone: string | null
  created_at: string
  villas_count?: number
  reservations_count?: number
}

/* Les tons viennent du composant Badge, donc des tokens : les couleurs
   Tailwind écrites en dur ici ne suivaient pas le thème sombre. */
const ROLE: Record<string, { label: string; ton: 'success' | 'warning' | 'neutre' }> = {
  admin: { label: 'Administrateur', ton: 'warning' },
  proprietaire: { label: 'Propriétaire', ton: 'success' },
  client: { label: 'Client', ton: 'neutre' },
}

const FILTRES = [
  { valeur: '', label: 'Tous' },
  { valeur: 'client', label: 'Clients' },
  { valeur: 'proprietaire', label: 'Propriétaires' },
  { valeur: 'admin', label: 'Admins' },
]

function initiales(nom: string) {
  return nom.split(' ').map((m) => m[0]).join('').toUpperCase().slice(0, 2)
}

export default function AdminUtilisateurs() {
  const { user: moi } = useAuth()
  const toast = useToast()
  const [role, setRole] = useState('')
  const [recherche, setRecherche] = useState('')
  const [terme, setTerme] = useState('')
  const [page, setPage] = useState(1)
  const [aSupprimer, setASupprimer] = useState<Utilisateur | null>(null)

  useEffect(() => {
    const t = setTimeout(() => { setTerme(recherche); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [recherche])

  const requete = `page=${page}${role ? `&role=${role}` : ''}${terme ? `&recherche=${encodeURIComponent(terme)}` : ''}`

  const { donnees, chargement, erreur, reessayer } = useRequete<Page<Utilisateur> | Utilisateur[]>(
    async (signal) => (await api.get(`/admin/utilisateurs?${requete}`, { signal })).data,
    requete,
    { messageErreurParDefaut: 'Impossible de charger les comptes.' }
  )

  const page_ = versPage(donnees)
  const comptes = page_?.data ?? []

  const supprimer = async (u: Utilisateur) => {
    try {
      await api.delete(`/admin/utilisateurs/${u.id}`)
      toast.succes(`Compte de ${u.name} supprimé.`)
      reessayer()
    } catch (err) {
      // Le serveur refuse la suppression d'un administrateur : le message
      // qu'il renvoie explique pourquoi, il faut le montrer tel quel.
      toast.erreur(messageErreur(err, "Le compte n'a pas pu être supprimé."))
    } finally {
      setASupprimer(null)
    }
  }

  return (
    <div>
      {aSupprimer && (
        <ConfirmModal
          message={`Supprimer le compte de ${aSupprimer.name} ?`}
          detail={
            (aSupprimer.villas_count ?? 0) > 0
              ? `Ce propriétaire a ${aSupprimer.villas_count} annonce(s). Elles seront supprimées avec son compte, et cette action est irréversible.`
              : 'Cette action est irréversible. Ses réservations et ses avis seront supprimés.'
          }
          confirmLabel="Supprimer"
          danger
          onConfirm={() => supprimer(aSupprimer)}
          onCancel={() => setASupprimer(null)}
        />
      )}

      <ListeConsole
        titre="Utilisateurs"
        sousTitre={page_
          ? `${page_.total} compte${page_.total > 1 ? 's' : ''} sur la plateforme`
          : 'Comptes de la plateforme'}
        chargement={chargement}
        erreur={erreur}
        reessayer={reessayer}
        vide={comptes.length === 0}
        videIcone={Users}
        squelette={5}
        videTexte={terme
          ? <>Aucun compte ne correspond à <strong>{terme}</strong>.</>
          : 'Aucun compte pour ce filtre.'}
        outils={<div className="console-filtres">
        <div className="console-onglets" role="tablist">
          {FILTRES.map((f) => (
            <button
              key={f.valeur || 'tous'}
              role="tab"
              aria-selected={role === f.valeur}
              onClick={() => { setRole(f.valeur); setPage(1) }}
              className={`console-onglet${role === f.valeur ? ' est-actif' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="console-recherche">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            className="champ-controle"
            placeholder="Nom, téléphone ou email…"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            aria-label="Rechercher un compte"
          />
        </div>
      </div>}
      >
        {/* Un tableau plutôt que des cartes : sur cet écran on balaie une
            colonne — les rôles, les dates — plutôt qu'on ne lit une fiche.
            Le cadre porte le défilement horizontal, jamais la page. */}
        <div className="tableau-cadre">
          <table className="tableau">
            <thead>
              <tr>
                <th scope="col">Compte</th>
                <th scope="col">Rôle</th>
                <th scope="col">Activité</th>
                <th scope="col">Inscrit le</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {comptes.map((u) => {
                const role = ROLE[u.role] ?? { label: u.role, ton: 'neutre' as const }
                const estMoi = u.id === moi?.id

                return (
                  <tr key={u.id}>
                    <td className="col-souple">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <span className="console-jeton" aria-hidden="true">{initiales(u.name)}</span>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: 0, fontWeight: 500, color: 'var(--text-1)' }}>
                            {u.name}{estMoi && <span style={{ color: 'var(--text-3)', fontWeight: 400 }}> · vous</span>}
                          </p>
                          {/* Le numéro d'abord, l'adresse ensuite : c'est par
                              téléphone qu'on joint un propriétaire ici, et
                              c'est aussi le numéro qui sert à se connecter.
                              Sans lui, il fallait ouvrir la fiche pour appeler. */}
                          <p style={{ margin: 0, font: 'var(--t-caption)', color: 'var(--text-3)' }}>
                            {u.phone
                              ? <>
                                  <a
                                    href={`tel:${u.phone.replace(/[^\d+]/g, '')}`}
                                    style={{ color: 'var(--text-2)', textDecoration: 'none' }}
                                  >
                                    {u.phone}
                                  </a>
                                  {u.email && <> · {u.email}</>}
                                </>
                              : u.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td><Badge ton={role.ton}>{role.label}</Badge></td>
                    <td style={{ color: 'var(--text-2)' }}>
                      {u.role === 'proprietaire'
                        ? `${u.villas_count ?? 0} annonce${(u.villas_count ?? 0) > 1 ? 's' : ''}`
                        : `${u.reservations_count ?? 0} réservation${(u.reservations_count ?? 0) > 1 ? 's' : ''}`}
                    </td>
                    <td style={{ color: 'var(--text-3)' }}>{dateCourte(u.created_at)}</td>
                    <td>
                      {/* Un compte administrateur ne se supprime pas depuis cet
                          écran — le serveur le refuse aussi. Montrer un bouton
                          qui échouera serait un piège. */}
                      {u.role === 'admin' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, font: 'var(--t-caption)', color: 'var(--text-3)' }}>
                          <ShieldCheck size={14} /> protégé
                        </span>
                      ) : (
                        <Button
                          variante="discret"
                          taille="sm"
                          onClick={() => setASupprimer(u)}
                          iconeAvant={<Trash2 size={15} />}
                          aria-label={`Supprimer le compte de ${u.name}`}
                        />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <Pagination page={page_} onChange={setPage} unite="compte" />
      </ListeConsole>
    </div>
  )
}
