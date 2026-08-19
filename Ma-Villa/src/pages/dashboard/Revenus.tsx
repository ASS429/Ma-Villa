import { Wallet, Hourglass, CheckCheck, Percent, Receipt, Inbox } from 'lucide-react'
import api from '../../services/api'
import { useRequete } from '../../lib/useRequete'
import { fcfa, dateCourte } from '../../lib/format'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'

interface Ligne {
  id: number
  reservation_id: number
  villa: string | null
  logement: string | null
  date_debut: string
  date_fin: string
  paye_le: string | null
  montant_client: number
  commission: number
  montant_proprietaire: number
  etat: 'du' | 'a_venir' | 'verse' | 'annule'
}

interface Versement {
  id: number
  montant: number
  methode: string
  reference: string | null
  verse_le: string
}

interface Revenus {
  a_venir: number
  du: number
  verse: number
  commission_retenue: number
  lignes: Ligne[]
  reversements: Versement[]
  methodes: Record<string, string>
}

const ETAT: Record<Ligne['etat'], { label: string; ton: 'warning' | 'success' | 'danger' | 'neutre' }> = {
  du:      { label: 'À verser',   ton: 'warning' },
  a_venir: { label: 'Séjour à venir', ton: 'neutre' },
  verse:   { label: 'Versé',      ton: 'success' },
  annule:  { label: 'Annulée',    ton: 'danger' },
}

export default function Revenus() {
  const { donnees, chargement, erreur, reessayer } = useRequete<Revenus>(
    async (signal) => (await api.get('/proprietaire/revenus', { signal })).data,
    'revenus',
    { messageErreurParDefaut: 'Impossible de charger vos revenus.' }
  )

  const lignes = donnees?.lignes ?? []
  const versements = donnees?.reversements ?? []

  return (
    <div>
      <p className="console-sous-titre">
        Ce que vos séjours vous rapportent, et où en est le versement. La
        commission est <strong>prélevée sur ce que paie le client</strong> —
        jamais ajoutée par-dessus votre prix.
      </p>

      {erreur && !chargement && (
        <div className="console-erreur" role="alert">
          {erreur}
          <Button variante="secondaire" taille="sm" onClick={reessayer}>Réessayer</Button>
        </div>
      )}

      <div className="chiffres">
        {[
          { cle: 'du', libelle: 'À vous verser', Icone: Wallet, valeur: donnees?.du,
            detail: 'Séjours terminés, en attente de virement', action: true },
          { cle: 'a_venir', libelle: 'À venir', Icone: Hourglass, valeur: donnees?.a_venir,
            detail: 'Encaissé, séjour pas encore terminé' },
          { cle: 'verse', libelle: 'Déjà versé', Icone: CheckCheck, valeur: donnees?.verse,
            detail: 'Total reçu depuis vos débuts' },
          { cle: 'commission', libelle: 'Commission retenue', Icone: Percent, valeur: donnees?.commission_retenue,
            detail: 'Part de la plateforme sur vos ventes' },
        ].map(({ cle, libelle, Icone, valeur, detail, action }) => (
          <div key={cle} className={`chiffre${action && (valeur ?? 0) > 0 ? ' demande-action' : ''}`}>
            <div className="chiffre-haut">
              <span className="chiffre-icone"><Icone size={17} aria-hidden="true" /></span>
            </div>
            {chargement
              ? <div className="skeleton" style={{ height: 26, width: '70%', borderRadius: 6 }} />
              : <p className="chiffre-valeur">{fcfa(valeur ?? 0)}</p>}
            <p className="chiffre-libelle">{libelle}</p>
            <p className="chiffre-detail">{detail}</p>
          </div>
        ))}
      </div>

      {/* Dire comment on est payé vaut mieux que laisser deviner : le virement
          est fait à la main, et un propriétaire qui l'ignore relance pour rien. */}
      <div className="console-note">
        <Receipt size={16} aria-hidden="true" />
        <p>
          Le versement est effectué <strong>après la fin du séjour</strong>, par
          Wave, Orange Money ou virement. Une notification vous prévient dès
          qu'il part. Une question ? Écrivez-nous depuis la réservation concernée.
        </p>
      </div>

      <div className="console-grille console-grille-large">
        <section className="panneau">
          <h2 className="panneau-titre">Détail par séjour</h2>

          {chargement ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[0, 1, 2].map((n) => (
                <div key={n} className="skeleton" style={{ height: 38, borderRadius: 8 }} />
              ))}
            </div>
          ) : lignes.length === 0 ? (
            <div className="console-vide">
              <span className="console-vide-icone"><Inbox size={22} /></span>
              <p>Aucun séjour payé pour l'instant. Vos revenus apparaîtront ici dès le premier règlement.</p>
            </div>
          ) : (
            <div className="tableau-cadre">
              <table className="tableau">
                <thead>
                  <tr>
                    <th scope="col">Séjour</th>
                    <th scope="col">Dates</th>
                    <th scope="col">Payé par le client</th>
                    <th scope="col">Commission</th>
                    <th scope="col">Votre part</th>
                    <th scope="col">État</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <span className="tableau-fort">{l.villa ?? '—'}</span>
                        {l.logement && <span className="tableau-second"> · {l.logement}</span>}
                      </td>
                      <td className="tableau-nombre">
                        {dateCourte(l.date_debut)} → {dateCourte(l.date_fin)}
                      </td>
                      <td className="tableau-nombre">{fcfa(l.montant_client)}</td>
                      <td className="tableau-nombre tableau-retrait">− {fcfa(l.commission)}</td>
                      <td className="tableau-nombre tableau-fort">{fcfa(l.montant_proprietaire)}</td>
                      <td><Badge ton={ETAT[l.etat].ton}>{ETAT[l.etat].label}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panneau">
          <h2 className="panneau-titre">Versements reçus</h2>

          {versements.length === 0 ? (
            <p className="console-sous-titre" style={{ margin: 0 }}>Aucun versement pour le moment.</p>
          ) : (
            <ul className="liste-versements">
              {versements.map((v) => (
                <li key={v.id}>
                  <div>
                    <p className="versement-montant">{fcfa(v.montant)}</p>
                    <p className="versement-detail">
                      {dateCourte(v.verse_le)} · {donnees?.methodes?.[v.methode] ?? v.methode}
                      {v.reference ? ` · ${v.reference}` : ''}
                    </p>
                  </div>
                  <CheckCheck size={16} aria-hidden="true" style={{ color: 'var(--success)', flex: 'none' }} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
