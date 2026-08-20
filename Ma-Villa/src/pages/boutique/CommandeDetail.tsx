import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Truck, HandCoins, PackageCheck, XCircle } from 'lucide-react'
import api from '../../services/api'
import { useConfig } from '../../context/ConfigContext'
import { useToast } from '../../context/ToastContext'
import { useRequete } from '../../lib/useRequete'
import { messageErreur } from '../../lib/erreurs'
import { fcfa, dateCourte } from '../../lib/format'
import { LIBELLES_STATUT_COMMANDE, type Commande } from '../../types'
import ChargementPage from '../../components/ChargementPage'
import Seo from '../../components/Seo'
import Navbar from '../../components/Navbar'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Champ, ChampSelection } from '../../components/ui/Champ'

const TON: Record<Commande['statut'], 'success' | 'warning' | 'danger' | 'neutre'> = {
  en_attente: 'warning',
  confirmee: 'success',
  expediee: 'neutre',
  livree: 'success',
  annulee: 'danger',
}

/** Les quatre étapes visibles par l'acheteur, dans l'ordre. */
const ETAPES = [
  { cle: 'confirmee', label: 'Confirmée', Icone: CheckCircle2 },
  { cle: 'expediee', label: 'Expédiée', Icone: Truck },
  { cle: 'livree', label: 'Livrée', Icone: PackageCheck },
] as const

export default function CommandeDetail() {
  const { id } = useParams<{ id: string }>()
  const { boutique, paiement, chargee } = useConfig()
  const toast = useToast()

  const [methode, setMethode] = useState('wave')
  const [telephone, setTelephone] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [lien, setLien] = useState<string | null>(null)
  const [annulation, setAnnulation] = useState(false)

  const { donnees: commande, chargement, erreur, reessayer } = useRequete<Commande>(
    async (signal) => (await api.get(`/commandes/${id}`, { signal })).data,
    `commande-${id}`,
    { messageErreurParDefaut: 'Cette commande est introuvable.' }
  )

  // Tant qu'un règlement est en vol, on interroge le serveur : le retour depuis
  // Wave ou Orange Money ne prévient de rien, c'est à nous d'aller voir.
  useEffect(() => {
    if (!lien) return

    const minuteur = setInterval(async () => {
      try {
        const { data } = await api.get(`/commandes/${id}/paiement/statut`)
        if (data.statut_paiement === 'reussi') {
          clearInterval(minuteur)
          toast.succes('Paiement reçu. Merci !')
          setLien(null)
          reessayer()
        } else if (data.statut_paiement === 'echoue') {
          clearInterval(minuteur)
          toast.erreur("Le paiement n'a pas abouti.")
          setLien(null)
          reessayer()
        }
      } catch {
        // Un relevé qui échoue n'est pas une erreur de paiement : on retentera.
      }
    }, 4000)

    return () => clearInterval(minuteur)
  }, [lien, id, toast, reessayer])

  // On attend de **savoir** avant de trancher : au premier rendu la
  // configuration n'est pas encore arrivée, et rediriger à ce moment-là
  // renvoyait à l'accueil alors que la boutique était ouverte.
  if (!chargee) return <ChargementPage />
  // Fermée, elle n'existe pas : ni page, ni URL à garder en mémoire.
  if (!boutique.actif) return <Navigate to="/" replace />

  const payer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!telephone.trim() || envoi) return

    setEnvoi(true)
    try {
      const { data } = await api.post(`/commandes/${id}/paiement`, {
        methode,
        telephone: telephone.trim(),
      })
      const cible = data.url_application || data.url || data.url_page
      if (!cible) throw new Error('Aucun lien de paiement reçu.')
      setLien(cible)
      // Sur téléphone, ouvrir l'application vaut mieux que demander un clic
      // de plus — le lien reste affiché pour ceux que la redirection rate.
      window.location.href = cible
    } catch (err) {
      toast.erreur(messageErreur(err, "Le paiement n'a pas pu être lancé."))
    } finally {
      setEnvoi(false)
    }
  }

  const annuler = async () => {
    setAnnulation(true)
    try {
      await api.patch(`/commandes/${id}/annuler`)
      toast.succes('Commande annulée.')
      reessayer()
    } catch (err) {
      toast.erreur(messageErreur(err, "La commande n'a pas pu être annulée."))
    } finally {
      setAnnulation(false)
    }
  }

  const aRegler = commande?.mode_paiement === 'en_ligne'
    && commande.statut_paiement !== 'reussi'
    && commande.statut !== 'annulee'

  const annulable = commande
    && !['expediee', 'livree', 'annulee'].includes(commande.statut)
    && commande.statut_paiement !== 'reussi'

  const etapeAtteinte = (cle: string) => {
    if (!commande || commande.statut === 'annulee') return false
    const ordre = ['en_attente', 'confirmee', 'expediee', 'livree']
    return ordre.indexOf(commande.statut) >= ordre.indexOf(cle)
  }

  return (
    <>
      <Seo titre="Ma commande" description="Suivi de votre commande." />
      <Navbar />

      <main className="tunnel">
        <Link to="/boutique/commandes" className="oeuvre-retour">
          <ArrowLeft size={16} aria-hidden="true" />
          Mes commandes
        </Link>

        {erreur && !chargement && (
          <div className="console-erreur" role="alert">
            {erreur}
            <Button variante="secondaire" taille="sm" onClick={reessayer}>Réessayer</Button>
          </div>
        )}

        {chargement ? (
          <div className="skeleton" style={{ height: 300, borderRadius: 'var(--r-lg)' }} />
        ) : commande ? (
          <div className="tunnel-corps">
            <section className="panneau">
              <div className="commande-entete">
                <div style={{ minWidth: 0 }}>
                  <h1 className="panneau-titre" style={{ margin: 0 }}>{commande.oeuvre_titre}</h1>
                  <p className="tableau-second">{commande.oeuvre_artiste}</p>
                </div>
                <Badge ton={TON[commande.statut]}>{LIBELLES_STATUT_COMMANDE[commande.statut]}</Badge>
              </div>

              {commande.reference && (
                <p className="commande-reference">Référence {commande.reference}</p>
              )}

              {/* Le fil des étapes : où en est mon colis, sans avoir à lire. */}
              {commande.statut !== 'annulee' ? (
                <ol className="commande-etapes">
                  {ETAPES.map(({ cle, label, Icone }) => (
                    <li key={cle} className={etapeAtteinte(cle) ? 'est-atteinte' : ''}>
                      <span className="commande-etape-puce"><Icone size={14} aria-hidden="true" /></span>
                      <span>{label}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="commande-annulee">
                  <XCircle size={16} aria-hidden="true" />
                  Commande annulée. L'œuvre est de nouveau en vente.
                </p>
              )}
            </section>

            <section className="panneau">
              <h2 className="panneau-titre">Détail</h2>
              <dl className="commande-detail">
                <div><dt>Œuvre</dt><dd>{fcfa(commande.montant_oeuvre)}</dd></div>
                <div>
                  <dt>Livraison</dt>
                  <dd>{commande.frais_livraison === 0 ? 'Gratuite' : fcfa(commande.frais_livraison)}</dd>
                </div>
                <div className="commande-detail-total">
                  <dt>Total</dt><dd>{fcfa(commande.montant_total)}</dd>
                </div>
              </dl>

              <p className="commande-adresse">
                {commande.destinataire} · {commande.telephone}<br />
                {commande.adresse}, {commande.ville}
              </p>

              <p className="tableau-second">
                Commandée le {dateCourte(commande.created_at)}
                {commande.mode_paiement === 'livraison' && ' · règlement à la livraison'}
                {commande.paye_le && ` · payée le ${dateCourte(commande.paye_le)}`}
              </p>
            </section>

            {commande.mode_paiement === 'livraison' && commande.statut !== 'annulee' && (
              <div className="console-note">
                <HandCoins size={16} aria-hidden="true" />
                <p>
                  Vous réglez <strong>{fcfa(commande.montant_total)}</strong> en main
                  propre à la remise de l'œuvre. Préparez l'appoint si possible.
                </p>
              </div>
            )}

            {aRegler && paiement.actif && (
              <section className="panneau">
                <h2 className="panneau-titre">Régler {fcfa(commande.montant_total)}</h2>

                {lien ? (
                  <>
                    <p className="tableau-second" style={{ marginBottom: 'var(--space-3)' }}>
                      Validez le paiement sur votre téléphone. Cette page se met à jour toute seule.
                    </p>
                    <a href={lien} className="btn btn-primaire btn-md" style={{ width: '100%', justifyContent: 'center' }}>
                      Rouvrir l'application de paiement
                    </a>
                  </>
                ) : (
                  <form onSubmit={payer} className="tunnel-champs">
                    <ChampSelection
                      label="Moyen de paiement"
                      value={methode}
                      onChange={(e) => setMethode(e.target.value)}
                    >
                      {paiement.moyens.map((m) => (
                        <option key={m.cle} value={m.cle}>{m.nom}</option>
                      ))}
                    </ChampSelection>

                    <Champ
                      label="Numéro à débiter"
                      type="tel"
                      value={telephone}
                      onChange={(e) => setTelephone(e.target.value)}
                      maxLength={30}
                      required
                    />

                    <Button
                      type="submit"
                      variante="primaire"
                      bloc
                      disabled={!telephone.trim() || envoi}
                      chargement={envoi}
                    >
                      Payer {fcfa(commande.montant_total)}
                    </Button>
                  </form>
                )}
              </section>
            )}

            {annulable && (
              <Button
                variante="secondaire"
                bloc
                onClick={annuler}
                disabled={annulation}
                chargement={annulation}
              >
                Annuler la commande
              </Button>
            )}
          </div>
        ) : null}
      </main>
    </>
  )
}
