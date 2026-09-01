import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Undo2, Inbox, X, AlertTriangle, Search, Smartphone } from 'lucide-react'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { useRequete } from '../../lib/useRequete'
import { messageErreur } from '../../lib/erreurs'
import { fcfa, dateCourte, depuis, periode } from '../../lib/format'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Champ, ChampZoneTexte } from '../../components/ui/Champ'

type Imputation = 'plateforme' | 'proprietaire' | 'client'

/**
 * Où renvoyer l'argent.
 *
 * `telephone_origine` dit d'où sort le numéro affiché, et ce n'est pas un
 * détail : celui du compte n'est pas celui du paiement — on s'inscrit avec son
 * téléphone et on paie avec le Wave d'un proche. Un virement mobile parti au
 * mauvais numéro ne revient pas.
 */
interface Reglement {
  methode: string
  methode_nom: string
  telephone: string | null
  telephone_origine: 'paiement' | 'prestataire' | 'compte' | null
  reference: string | null
  paye_le: string | null
  recu_url: string | null
}

const ORIGINE: Record<'paiement' | 'prestataire' | 'compte', { note: string; sur: boolean }> = {
  paiement: { note: 'Numéro saisi au moment du paiement.', sur: true },
  prestataire: { note: 'Numéro transmis par PayDunya.', sur: true },
  compte: {
    note: "⚠️ Numéro du compte, pas celui du paiement — ce règlement est antérieur au 1ᵉʳ septembre 2026. Vérifiez le reçu PayDunya avant de virer.",
    sur: false,
  },
}

/** Une réservation dont le client attend une décision. */
interface Demande {
  id: number
  date_debut: string
  date_fin: string
  demandee_le: string
  motif: string | null
  client: string | null
  contact: string | null
  hebergement: string | null
  ville: string | null
  montant: number
  part_proprietaire: number
  proprietaire_deja_paye: boolean
  paiement: Reglement | null
}

interface Ligne {
  id: number
  montant: number
  impute_a: Imputation
  motif: string
  reference: string | null
  commission_rendue: boolean
  a_recuperer_proprietaire: number
  createur_nom: string | null
  created_at: string
  reservation: { id: number; date_debut: string; date_fin: string; client?: { name: string } | null } | null
}

interface Page {
  data: Ligne[]
  demandes: Demande[]
  total_rendu: number
  a_recuperer: number
  imputations: Record<Imputation, string>
}

/** Ce que le serveur propose de rendre, une fois la cause choisie. */
interface Proposition {
  montant: number
  commission_rendue: boolean
  explication: string
  deja_rendu: number
  montant_encaisse: number
  part_proprietaire: number
  proprietaire_deja_paye: boolean
  avertissement: string | null
  paiement: Reglement
}

const TON: Record<Imputation, 'danger' | 'warning' | 'neutre'> = {
  plateforme: 'danger',
  proprietaire: 'warning',
  client: 'neutre',
}

/**
 * Où renvoyer l'argent, affiché là où la décision se prend.
 *
 * L'écran disait tout du séjour et rien du règlement : il fallait le quitter
 * pour aller chercher, chez PayDunya, le numéro et le moyen — c'est-à-dire les
 * deux seules choses dont on a besoin pour virer.
 */
function Reglement({ reglement }: { reglement: Reglement }) {
  const origine = reglement.telephone_origine ? ORIGINE[reglement.telephone_origine] : null

  return (
    <div className="reglement">
      <p className="reglement-ligne">
        <Smartphone size={14} aria-hidden="true" />
        <strong>{reglement.telephone ?? 'Numéro inconnu'}</strong>
        <span>· {reglement.methode_nom}</span>
      </p>
      {origine && (
        <p className={`reglement-note${origine.sur ? '' : ' est-douteux'}`}>{origine.note}</p>
      )}
      {!reglement.telephone && (
        <p className="reglement-note est-douteux">
          Aucun numéro enregistré pour ce règlement. Le reçu PayDunya porte celui
          qui a été débité.
        </p>
      )}
      <p className="reglement-note">
        {reglement.reference ?? 'Sans référence'}
        {reglement.paye_le ? ` · payé le ${dateCourte(reglement.paye_le)}` : ''}
        {reglement.recu_url && (
          <>
            {' · '}
            <a href={reglement.recu_url} target="_blank" rel="noopener noreferrer">Reçu PayDunya</a>
          </>
        )}
      </p>
    </div>
  )
}

/**
 * Rendre l'argent au client.
 *
 * Le virement de retour se fait chez PayDunya, à la main, comme les
 * reversements : cet écran <strong>constate</strong>. Ce qu'il apporte, et qui
 * manquait, c'est que le remboursement cesse d'être invisible — retranché du
 * chiffre d'affaires, motivé, et chiffré quand un propriétaire déjà payé doit
 * rendre sa part.
 */
export default function AdminRemboursements() {
  const toast = useToast()

  const [cible, setCible] = useState<{ id: number; titre: string } | null>(null)
  const [imputeA, setImputeA] = useState<Imputation>('client')
  const [montant, setMontant] = useState('')
  const [motif, setMotif] = useState('')
  const [reference, setReference] = useState('')
  const [proposition, setProposition] = useState<Proposition | null>(null)
  const [erreurProposition, setErreurProposition] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [numero, setNumero] = useState('')

  const { donnees, chargement, erreur, reessayer } = useRequete<Page>(
    async (signal) => (await api.get('/admin/remboursements', { signal })).data,
    'remboursements',
    { messageErreurParDefaut: "Impossible de charger l'historique des remboursements." }
  )

  const demandes = donnees?.demandes ?? []
  const historique = donnees?.data ?? []
  const imputations = donnees?.imputations ?? {
    plateforme: 'La plateforme', proprietaire: 'Le propriétaire', client: 'Le client',
  }

  /*
   * Le montant proposé se recalcule à chaque changement de cause, et le champ
   * suit. Voir la somme bouger en cochant « c'est de notre faute » enseigne la
   * règle mieux qu'un paragraphe d'aide : elle passe de la moitié au tout.
   */
  useEffect(() => {
    if (!cible) return

    const controleur = new AbortController()

    api
      .get(`/admin/reservations/${cible.id}/remboursement`, {
        params: { impute_a: imputeA },
        signal: controleur.signal,
      })
      .then(({ data }) => {
        setProposition(data)
        setErreurProposition(null)
        setMontant(String(data.montant))
      })
      .catch((err) => {
        if (controleur.signal.aborted) return
        setProposition(null)
        setErreurProposition(messageErreur(err, "Impossible de calculer le montant proposé."))
      })

    return () => controleur.abort()
  }, [cible, imputeA])

  const ouvrir = (id: number, titre: string, cause: Imputation = 'client') => {
    setCible({ id, titre })
    setImputeA(cause)
    setMontant('')
    setMotif('')
    setReference('')
    setProposition(null)
    setErreurProposition(null)
  }

  // Le nettoyage se fait ici et non dans l'effet : y remettre l'état à zéro
  // relance un rendu en cascade pour rien, la modale étant déjà fermée.
  const fermer = () => {
    setCible(null)
    setProposition(null)
    setErreurProposition(null)
  }

  // Rembourser une réservation qui n'a rien demandé : une villa devenue
  // indisponible n'attend pas que le client réclame pour être remboursée.
  const ouvrirParNumero = () => {
    const id = Number(numero.trim())
    if (!Number.isInteger(id) || id <= 0) {
      toast.erreur('Saisissez le numéro de la réservation.')
      return
    }
    ouvrir(id, `Réservation n° ${id}`, 'plateforme')
  }

  const somme = Number(montant)
  const valide =
    proposition !== null &&
    Number.isFinite(somme) && somme >= 0 &&
    somme <= proposition.montant_encaisse - proposition.deja_rendu + 0.001 &&
    motif.trim().length >= 10

  const enregistrer = async () => {
    if (!cible || !valide || envoi) return

    setEnvoi(true)
    try {
      await api.post(`/admin/reservations/${cible.id}/remboursement`, {
        montant: somme,
        impute_a: imputeA,
        motif: motif.trim(),
        reference: reference.trim() || null,
        commission_rendue: proposition?.commission_rendue ?? false,
      })
      toast.succes(`${fcfa(somme)} enregistrés pour ${cible.titre}.`)
      fermer()
      setNumero('')
      reessayer()
    } catch (err) {
      toast.erreur(messageErreur(err, "Le remboursement n'a pas été enregistré."))
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <div>
      <h1 className="console-titre">Remboursements</h1>
      <p className="console-sous-titre">
        Comme les reversements, cet écran ne déplace pas d'argent :{' '}
        <strong>faites le virement de retour, puis enregistrez-le ici</strong>.
        La réservation est alors annulée, la date se libère et la part du
        propriétaire cesse d'être exigible.
      </p>

      {erreur && !chargement && (
        <div className="console-erreur" role="alert">
          {erreur}
          <Button variante="secondaire" taille="sm" onClick={reessayer}>Réessayer</Button>
        </div>
      )}

      <div className="chiffres">
        <div className={`chiffre${demandes.length > 0 ? ' demande-action' : ''}`}>
          <div className="chiffre-haut">
            <span className="chiffre-icone"><Inbox size={17} aria-hidden="true" /></span>
          </div>
          <p className="chiffre-valeur">{demandes.length}</p>
          <p className="chiffre-libelle">Demandes en attente</p>
          <p className="chiffre-detail">Clients qui attendent une décision</p>
        </div>

        <div className="chiffre">
          <div className="chiffre-haut">
            <span className="chiffre-icone"><Undo2 size={17} aria-hidden="true" /></span>
          </div>
          <p className="chiffre-valeur">{fcfa(donnees?.total_rendu ?? 0)}</p>
          <p className="chiffre-libelle">Rendu aux clients</p>
          <p className="chiffre-detail">Depuis l'ouverture</p>
        </div>

        {/* Le seul chiffre qui appelle une action hors de l'application :
            personne ne le réclamera si l'écran ne le montre pas. */}
        <div className={`chiffre${(donnees?.a_recuperer ?? 0) > 0 ? ' demande-action' : ''}`}>
          <div className="chiffre-haut">
            <span className="chiffre-icone"><AlertTriangle size={17} aria-hidden="true" /></span>
          </div>
          <p className="chiffre-valeur">{fcfa(donnees?.a_recuperer ?? 0)}</p>
          <p className="chiffre-libelle">À récupérer</p>
          <p className="chiffre-detail">Chez des propriétaires déjà payés</p>
        </div>
      </div>

      <section className="panneau">
        <h2 className="panneau-titre">Demandes d'annulation</h2>

        {chargement ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1].map((n) => <div key={n} className="skeleton" style={{ height: 38, borderRadius: 8 }} />)}
          </div>
        ) : demandes.length === 0 ? (
          <div className="console-vide">
            <span className="console-vide-icone"><Inbox size={22} /></span>
            <p>Aucun client n'attend de décision.</p>
          </div>
        ) : (
          <div className="tableau-cadre">
            <table className="tableau">
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col">Séjour</th>
                  <th scope="col">Demandée</th>
                  <th scope="col">Encaissé</th>
                  <th scope="col"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {demandes.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <span className="tableau-fort">{d.client ?? 'Client supprimé'}</span>
                      {d.contact && <span className="tableau-second"> · {d.contact}</span>}
                      {/* Le motif décide de l'imputation, donc du montant.
                          Le cacher derrière un clic ferait trancher à l'aveugle. */}
                      {d.motif && <p className="tableau-second">« {d.motif} »</p>}
                    </td>
                    <td>
                      <span className="tableau-fort">{d.hebergement ?? '—'}</span>
                      <span className="tableau-second"> · {periode(d.date_debut, d.date_fin)}</span>
                    </td>
                    <td>
                      {depuis(d.demandee_le)}
                      {d.proprietaire_deja_paye && (
                        <>
                          {' '}
                          <Badge ton="warning">Propriétaire déjà payé</Badge>
                        </>
                      )}
                    </td>
                    <td className="tableau-nombre tableau-fort">
                      {fcfa(d.montant)}
                      {d.paiement && <Reglement reglement={d.paiement} />}
                    </td>
                    <td>
                      <Button
                        variante="primaire" taille="sm"
                        onClick={() => ouvrir(d.id, `la réservation n° ${d.id}`)}
                      >
                        Décider
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="remboursement-recherche">
          <Champ
            label="Rembourser une autre réservation"
            aide="Son numéro. Utile quand c'est nous qui annulons, avant que le client ne demande."
            value={numero}
            inputMode="numeric"
            onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') ouvrirParNumero() }}
            placeholder="Ex. 142"
          />
          <Button
            variante="secondaire" onClick={ouvrirParNumero}
            disabled={!numero.trim()} iconeAvant={<Search size={16} />}
          >
            Ouvrir
          </Button>
        </div>
      </section>

      <section className="panneau">
        <h2 className="panneau-titre">Derniers remboursements</h2>

        {historique.length === 0 ? (
          <p className="console-sous-titre" style={{ margin: 0 }}>Aucun remboursement enregistré.</p>
        ) : (
          <ul className="liste-versements">
            {historique.map((r) => (
              <li key={r.id}>
                <div style={{ minWidth: 0 }}>
                  <p className="versement-montant">{fcfa(r.montant)}</p>
                  <p className="versement-detail">
                    {r.reservation?.client?.name ?? `Réservation n° ${r.reservation?.id ?? '—'}`}
                    {' · '}{dateCourte(r.created_at)}
                    {r.createur_nom ? ` · ${r.createur_nom}` : ''}
                    {r.reference ? ` · ${r.reference}` : ''}
                  </p>
                  <p className="versement-detail">{r.motif}</p>
                  {Number(r.a_recuperer_proprietaire) > 0 && (
                    <p className="versement-echec">
                      {fcfa(r.a_recuperer_proprietaire)} à récupérer chez le propriétaire.
                    </p>
                  )}
                </div>
                <Badge ton={TON[r.impute_a]}>{imputations[r.impute_a] ?? r.impute_a}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      {cible && (
        <>
          <div
            className="console-voile"
            onClick={() => { if (!envoi && !motif.trim() && !reference.trim()) fermer() }}
            aria-hidden="true"
          />
          <div className="modale" role="dialog" aria-modal="true" aria-labelledby="titre-remboursement">
            <div className="modale-entete">
              <h2 id="titre-remboursement" className="panneau-titre" style={{ margin: 0 }}>
                Rembourser {cible.titre}
              </h2>
              <Button
                variante="discret" taille="sm" onClick={fermer}
                iconeAvant={<X size={18} />} aria-label="Fermer"
              />
            </div>

            {erreurProposition ? (
              <p className="console-erreur" role="alert" style={{ marginTop: 0 }}>{erreurProposition}</p>
            ) : (
              <>
                <p className="modale-montant">{fcfa(proposition?.montant ?? 0)}</p>
                <p className="console-sous-titre">
                  {proposition?.explication ?? 'Calcul en cours…'}
                </p>
              </>
            )}

            {proposition?.paiement && (
              <div className="console-note">
                <Smartphone size={16} aria-hidden="true" />
                <div>
                  <p><strong>Où renvoyer l'argent</strong></p>
                  <Reglement reglement={proposition.paiement} />
                </div>
              </div>
            )}

            {/* L'avertissement, pas le refus : l'argent est déjà sorti dans la
                réalité, et un logiciel qui dit non ne le fait pas revenir. */}
            {proposition?.avertissement && (
              <div className="console-note console-note-alerte">
                <AlertTriangle size={16} aria-hidden="true" />
                <p>{proposition.avertissement}</p>
              </div>
            )}

            <div className="modale-formulaire">
              <fieldset className="choix-mode">
                <legend className="champ-label">À qui l'annulation est-elle imputable ?</legend>
                {([
                  ['plateforme', imputations.plateforme, 'Notre faute. Remboursement intégral, commission comprise.'],
                  ['proprietaire', imputations.proprietaire, "Logement indisponible, propriétaire injoignable. Remboursement intégral."],
                  ['client', imputations.client, 'Il se désiste. Le barème s’applique sur sa part.'],
                ] as const).map(([valeur, titre, aide]) => (
                  <label key={valeur} className={`choix${imputeA === valeur ? ' est-actif' : ''}`}>
                    <input
                      type="radio" name="imputation" value={valeur}
                      checked={imputeA === valeur}
                      onChange={() => setImputeA(valeur as Imputation)}
                    />
                    <span>
                      <span className="choix-titre">{titre}</span>
                      <span className="choix-aide">{aide}</span>
                    </span>
                  </label>
                ))}
              </fieldset>

              {/* Modifiable, contrairement aux reversements : un reversement se
                  calcule, un remboursement se décide. Le barème propose. */}
              <Champ
                label="Montant rendu (FCFA)"
                aide={
                  proposition
                    ? `Encaissé : ${fcfa(proposition.montant_encaisse)}${
                        proposition.deja_rendu > 0 ? ` · déjà rendu : ${fcfa(proposition.deja_rendu)}` : ''
                      }`
                    : undefined
                }
                value={montant}
                inputMode="numeric"
                onChange={(e) => setMontant(e.target.value.replace(/[^\d]/g, ''))}
              />

              <ChampZoneTexte
                label="Motif"
                aide="Ce qui expliquera la ligne dans six mois, à vous ou à un tiers."
                rows={3}
                maxLength={500}
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Ex. Dégât des eaux, logement inhabitable ; client prévenu la veille."
              />

              <Champ
                label="Référence du virement de retour"
                aide="Facultatif, mais c'est ce qui permettra de le retrouver."
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                maxLength={120}
                placeholder="Identifiant Wave, Orange Money ou virement"
              />
            </div>

            <div className="modale-actions">
              <Button variante="secondaire" onClick={fermer} disabled={envoi}>
                Annuler
              </Button>
              <Button variante="primaire" onClick={enregistrer} chargement={envoi} disabled={!valide}>
                Enregistrer {somme > 0 ? fcfa(somme) : ''}
              </Button>
            </div>

            <p className="console-sous-titre" style={{ marginBottom: 0 }}>
              Le virement de retour se fait sur{' '}
              <Link to="/admin/paiement">le tableau PayDunya</Link>, pas ici.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
