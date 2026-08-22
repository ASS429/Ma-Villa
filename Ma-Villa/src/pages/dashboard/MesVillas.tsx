import { Link } from 'react-router-dom'
import { Building2, Plus, ArrowRight, Clock } from 'lucide-react'
import api from '../../services/api'
import { useRequete } from '../../lib/useRequete'
import { depuis } from '../../lib/format'
import Button, { ButtonLink } from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'

interface Villa {
  id: number
  nom: string
  ville: string
  statut: 'brouillon' | 'en_attente' | 'validee' | 'rejetee'
  telephone: string
  created_at: string
}

/* Tons issus du composant Badge, donc des tokens : les couleurs Tailwind
   écrites en dur ne suivaient pas le thème sombre. */
const STATUT: Record<Villa['statut'], { label: string; ton: 'warning' | 'success' | 'danger' | 'neutre' }> = {
  brouillon: { label: 'Brouillon', ton: 'neutre' },
  en_attente: { label: 'En attente', ton: 'warning' },
  validee: { label: 'Publiée', ton: 'success' },
  rejetee: { label: 'Rejetée', ton: 'danger' },
}

export default function MesVillas() {
  const { donnees, chargement, erreur, reessayer } = useRequete<Villa[]>(
    async (signal) => (await api.get('/proprietaire/villas', { signal })).data,
    'mes-villas',
    { messageErreurParDefaut: 'Impossible de charger vos villas.' }
  )

  const villas = donnees ?? []
  const enAttente = villas.filter((v) => v.statut === 'en_attente').length

  return (
    <div>
      <h1 className="console-titre">Mes villas</h1>
      <p className="console-sous-titre">
        {villas.length > 0
          ? `${villas.length} annonce${villas.length > 1 ? 's' : ''}${enAttente > 0 ? ` · ${enAttente} en cours de validation` : ''}`
          : 'Vos annonces et leur état de publication.'}
      </p>

      <div className="console-filtres">
        <ButtonLink to="/dashboard/villas/nouvelle" variante="primaire" taille="sm" iconeAvant={<Plus size={15} />}>
          Nouvelle villa
        </ButtonLink>
      </div>

      {erreur && !chargement && (
        <div className="console-erreur" role="alert">
          {erreur}
          <Button variante="secondaire" taille="sm" onClick={reessayer}>Réessayer</Button>
        </div>
      )}

      {chargement ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {[1, 2, 3].map((n) => (
            <div key={n} className="panneau">
              <div className="skeleton" style={{ height: 15, width: '35%', borderRadius: 6, marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 12, width: '25%', borderRadius: 6 }} />
            </div>
          ))}
        </div>
      ) : villas.length === 0 ? (
        <div className="console-vide">
          <span className="console-vide-icone"><Building2 size={22} /></span>
          <p>
            <strong>Aucune villa pour l'instant.</strong> Publiez votre première annonce pour
            commencer à recevoir des réservations.
          </p>
          <ButtonLink to="/dashboard/villas/nouvelle" variante="primaire" taille="sm" iconeAvant={<Plus size={15} />}>
            Publier ma première villa
          </ButtonLink>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {villas.map((villa) => {
            const statut = STATUT[villa.statut]

            return (
              <Link
                key={villa.id}
                // Un brouillon se reprend dans le formulaire, là où il a été
                // laissé ; l'écran de gestion suppose une annonce complète et
                // n'aurait presque rien à montrer.
                to={villa.statut === 'brouillon'
                  ? `/dashboard/villas/nouvelle?brouillon=${villa.id}`
                  : `/dashboard/villas/${villa.id}`}
                className="panneau raccourci"
              >
                <span className="chiffre-icone" aria-hidden="true"><Building2 size={16} /></span>

                <span className="raccourci-texte">
                  <span className="raccourci-titre">{villa.nom}</span>
                  <span className="raccourci-detail">
                    {villa.ville} · {villa.statut === 'brouillon' ? 'commencée' : 'déposée'} {depuis(villa.created_at)}
                  </span>
                </span>

                <Badge ton={statut.ton}>{statut.label}</Badge>
                <ArrowRight size={16} className="raccourci-fleche" aria-hidden="true" />
              </Link>
            )
          })}

          {/* Une annonce en attente n'est visible de personne : le dire ici
              évite au propriétaire de croire à une panne d'affichage. */}
          {enAttente > 0 && (
            <p
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                margin: 'var(--space-2) 0 0', font: 'var(--t-caption)', color: 'var(--text-3)',
              }}
            >
              <Clock size={13} aria-hidden="true" />
              Une annonce en attente reste invisible du public jusqu'à sa validation.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
