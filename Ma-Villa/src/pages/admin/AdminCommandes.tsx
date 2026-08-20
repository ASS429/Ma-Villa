import { useState } from 'react'
import { ShoppingBag, ImageOff } from 'lucide-react'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { useRequete } from '../../lib/useRequete'
import { messageErreur } from '../../lib/erreurs'
import { fcfa, dateCourte } from '../../lib/format'
import { versPage, type Page } from '../../lib/page'
import { LIBELLES_STATUT_COMMANDE, type Commande, type StatutCommande } from '../../types'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Pagination from '../../components/console/Pagination'

const TON: Record<StatutCommande, 'success' | 'warning' | 'danger' | 'neutre'> = {
  en_attente: 'warning',
  confirmee: 'success',
  expediee: 'neutre',
  livree: 'success',
  annulee: 'danger',
}

const FILTRES = [
  { valeur: '', label: 'Toutes' },
  { valeur: 'confirmee', label: 'À expédier' },
  { valeur: 'expediee', label: 'En route' },
  { valeur: 'en_attente', label: 'En attente' },
  { valeur: 'livree', label: 'Livrées' },
]

/** L'étape suivante, pour chaque état. Un seul bouton, jamais un menu. */
const SUITE: Partial<Record<StatutCommande, { vers: StatutCommande; label: string }>> = {
  en_attente: { vers: 'confirmee', label: 'Confirmer' },
  confirmee: { vers: 'expediee', label: 'Marquer expédiée' },
  expediee: { vers: 'livree', label: 'Marquer livrée' },
}

export default function AdminCommandes() {
  const toast = useToast()
  const [filtre, setFiltre] = useState('')
  const [page, setPage] = useState(1)
  const [enCours, setEnCours] = useState<number | null>(null)

  const query = `${filtre ? `statut=${filtre}&` : ''}page=${page}`

  const { donnees, chargement, erreur, reessayer } = useRequete<Page<Commande> | Commande[]>(
    async (signal) => (await api.get(`/admin/commandes?${query}`, { signal })).data,
    `admin-commandes-${query}`,
    { messageErreurParDefaut: 'Impossible de charger les commandes.' }
  )

  const resultat = versPage<Commande>(donnees)
  const liste = resultat?.data ?? []

  const avancer = async (commande: Commande, vers: StatutCommande) => {
    setEnCours(commande.id)
    try {
      await api.patch(`/admin/commandes/${commande.id}/statut`, { statut: vers })
      toast.succes(
        vers === 'livree' && commande.mode_paiement === 'livraison'
          ? `Livrée et réglée — ${fcfa(commande.montant_total)} encaissés.`
          : `Commande ${LIBELLES_STATUT_COMMANDE[vers].toLowerCase()}.`
      )
      reessayer()
    } catch (err) {
      toast.erreur(messageErreur(err, "Le statut n'a pas pu être changé."))
    } finally {
      setEnCours(null)
    }
  }

  return (
    <div>
      <h1 className="console-titre">Commandes</h1>
      <p className="console-sous-titre">
        Une œuvre par commande. Marquer une commande livrée la solde lorsqu'elle
        est payable à la livraison — c'est le moment où l'argent change de mains.
      </p>

      <div className="console-filtres">
        <div className="console-onglets" role="tablist">
          {FILTRES.map((f) => (
            <button
              key={f.valeur}
              role="tab"
              aria-selected={filtre === f.valeur}
              className={`console-onglet${filtre === f.valeur ? ' est-actif' : ''}`}
              onClick={() => { setFiltre(f.valeur); setPage(1) }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {erreur && !chargement && (
        <div className="console-erreur" role="alert">
          {erreur}
          <Button variante="secondaire" taille="sm" onClick={reessayer}>Réessayer</Button>
        </div>
      )}

      {chargement ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2].map((n) => <div key={n} className="skeleton" style={{ height: 92, borderRadius: 10 }} />)}
        </div>
      ) : liste.length === 0 ? (
        <div className="console-vide">
          <span className="console-vide-icone"><ShoppingBag size={22} /></span>
          <p>Aucune commande {filtre ? 'dans cet état' : 'pour l\'instant'}.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {liste.map((c) => {
              const suite = SUITE[c.statut]
              const aRegler = c.mode_paiement === 'en_ligne' && c.statut_paiement !== 'reussi'

              return (
                <article key={c.id} className="panneau commande-admin">
                  <div className="commande-admin-haut">
                    {c.oeuvre?.photos?.[0] ? (
                      <img src={c.oeuvre.photos[0].url} alt="" className="commande-vignette" loading="lazy" />
                    ) : (
                      <span className="commande-vignette carte-oeuvre-vide" aria-hidden="true">
                        <ImageOff size={18} />
                      </span>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="tableau-fort">{c.oeuvre_titre}</p>
                      <p className="tableau-second">{c.oeuvre_artiste} · {c.reference}</p>
                    </div>

                    <div className="commande-ligne-droite">
                      <Badge ton={TON[c.statut]}>{LIBELLES_STATUT_COMMANDE[c.statut]}</Badge>
                      <p className="commande-montant">{fcfa(c.montant_total)}</p>
                    </div>
                  </div>

                  <dl className="commande-admin-faits">
                    <div>
                      <dt>Acheteur</dt>
                      <dd>{c.destinataire} · {c.telephone}</dd>
                    </div>
                    <div>
                      <dt>Livraison</dt>
                      <dd>{c.adresse}, {c.ville}</dd>
                    </div>
                    <div>
                      <dt>Règlement</dt>
                      <dd>
                        {c.mode_paiement === 'livraison' ? 'À la livraison' : 'En ligne'}
                        {/* Ce qui n'est pas encore encaissé doit sauter aux
                            yeux : c'est ce qui décide si l'on expédie. */}
                        {aRegler && <span className="commande-impaye"> · non réglé</span>}
                        {c.paye_le && ` · payé le ${dateCourte(c.paye_le)}`}
                      </dd>
                    </div>
                    {c.note && (
                      <div><dt>Précision</dt><dd>{c.note}</dd></div>
                    )}
                  </dl>

                  {c.statut !== 'annulee' && c.statut !== 'livree' && (
                    <div className="reservation-actions">
                      {suite && (
                        <Button
                          variante="primaire"
                          taille="sm"
                          disabled={enCours === c.id}
                          onClick={() => avancer(c, suite.vers)}
                        >
                          {suite.label}
                        </Button>
                      )}
                      <Button
                        variante="secondaire"
                        taille="sm"
                        disabled={enCours === c.id}
                        onClick={() => avancer(c, 'annulee')}
                      >
                        Annuler
                      </Button>
                    </div>
                  )}
                </article>
              )
            })}
          </div>

          <Pagination page={resultat} onChange={setPage} unite="commandes" />
        </>
      )}
    </div>
  )
}
