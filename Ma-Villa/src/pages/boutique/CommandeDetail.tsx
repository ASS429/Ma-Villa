import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Truck, HandCoins, PackageCheck, XCircle } from 'lucide-react'
import api from '../../services/api'
import { useConfig } from '../../context/ConfigContext'
import { useToast } from '../../context/ToastContext'
import { useRequete } from '../../lib/useRequete'
import { messageErreur } from '../../lib/erreurs'
import { fcfa, dateCourte } from '../../lib/format'
import type { Commande } from '../../types'
import { METIER } from '../../i18n/metier'
import ChargementPage from '../../components/ChargementPage'
import Seo from '../../components/Seo'
import Navbar from '../../components/Navbar'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Champ, ChampSelection } from '../../components/ui/Champ'
import { useLangue } from '../../i18n/langue'
import { TEXTES_BOUTIQUE } from '../../i18n/boutique'
import CodeQR from '../../components/paiement/CodeQR'
import { surAppareilMobile } from '../../lib/appareil'

const TON: Record<Commande['statut'], 'success' | 'warning' | 'danger' | 'neutre'> = {
  en_attente: 'warning',
  confirmee: 'success',
  expediee: 'neutre',
  livree: 'success',
  annulee: 'danger',
}

/** Les quatre étapes visibles par l'acheteur, dans l'ordre. */
const ETAPES = [
  { cle: 'confirmee', Icone: CheckCircle2 },
  { cle: 'expediee', Icone: Truck },
  { cle: 'livree', Icone: PackageCheck },
] as const

export default function CommandeDetail() {
  const { id } = useParams<{ id: string }>()
  const { boutique, paiement, chargee } = useConfig()
  const toast = useToast()
  const { langue, lien: chemin } = useLangue()
  const t = TEXTES_BOUTIQUE[langue].suivi

  const [methode, setMethode] = useState('wave')
  const [telephone, setTelephone] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [lien, setLien] = useState<string | null>(null)
  const [mobile] = useState(surAppareilMobile)
  const [annulation, setAnnulation] = useState(false)

  const { donnees: commande, chargement, erreur, reessayer } = useRequete<Commande>(
    async (signal) => (await api.get(`/commandes/${id}`, { signal })).data,
    `commande-${id}`,
    { messageErreurParDefaut: t.introuvable }
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
          toast.succes(t.paiementRecu)
          setLien(null)
          reessayer()
        } else if (data.statut_paiement === 'echoue') {
          clearInterval(minuteur)
          toast.erreur(t.paiementEchoue)
          setLien(null)
          reessayer()
        }
      } catch {
        // Un relevé qui échoue n'est pas une erreur de paiement : on retentera.
      }
    }, 4000)

    return () => clearInterval(minuteur)
  }, [lien, id, toast, reessayer, t])

  // On attend de **savoir** avant de trancher : au premier rendu la
  // configuration n'est pas encore arrivée, et rediriger à ce moment-là
  // renvoyait à l'accueil alors que la boutique était ouverte.
  if (!chargee) return <ChargementPage />
  // Fermée, elle n'existe pas : ni page, ni URL à garder en mémoire.
  if (!boutique.actif) return <Navigate to={chemin('/')} replace />

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
      if (!cible) throw new Error(t.aucunLien)
      setLien(cible)
      // Sur téléphone, ouvrir l'application vaut mieux que demander un clic
      // de plus — le lien reste affiché pour ceux que la redirection rate.
      // Sur ordinateur, la page de l'opérateur ne sert à rien (celle
      // d'Orange Money n'a pas de code QR) : on montre le nôtre, et cette
      // page suit le paiement. La carte, elle, se saisit sur la page PayDunya.
      if (mobile || methode === 'carte') window.location.href = cible
    } catch (err) {
      toast.erreur(messageErreur(err, t.lancementEchoue))
    } finally {
      setEnvoi(false)
    }
  }

  const annuler = async () => {
    setAnnulation(true)
    try {
      await api.patch(`/commandes/${id}/annuler`)
      toast.succes(t.annulee)
      reessayer()
    } catch (err) {
      toast.erreur(messageErreur(err, t.annulationEchouee))
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
      <Seo titre={t.seoTitre} description={t.seoDescription} />
      <Navbar />

      <div className="achat">
        <Link to={chemin('/boutique/commandes')} className="oeuvre-retour">
          <ArrowLeft size={16} aria-hidden="true" />
          {t.mesCommandes}
        </Link>

        {erreur && !chargement && (
          <div className="console-erreur" role="alert">
            {erreur}
            <Button variante="secondaire" taille="sm" onClick={reessayer}>{t.reessayer}</Button>
          </div>
        )}

        {chargement ? (
          <div className="skeleton" style={{ height: 300, borderRadius: 'var(--r-lg)' }} />
        ) : commande ? (
          <div className="achat-corps">
            <section className="panneau">
              <div className="achat-entete">
                <div style={{ minWidth: 0 }}>
                  <h1 className="panneau-titre" style={{ margin: 0 }}>{commande.oeuvre_titre}</h1>
                  <p className="tableau-second">{commande.oeuvre_artiste}</p>
                </div>
                <Badge ton={TON[commande.statut]}>{METIER[langue].statutCommande[commande.statut]}</Badge>
              </div>

              {commande.reference && (
                <p className="commande-reference">{t.reference(commande.reference)}</p>
              )}

              {/* Le fil des étapes : où en est mon colis, sans avoir à lire. */}
              {commande.statut !== 'annulee' ? (
                <ol className="commande-etapes">
                  {ETAPES.map(({ cle, Icone }) => (
                    <li key={cle} className={etapeAtteinte(cle) ? 'est-atteinte' : ''}>
                      <span className="commande-etape-puce"><Icone size={14} aria-hidden="true" /></span>
                      <span>{t.etapes[cle]}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="commande-annulee">
                  <XCircle size={16} aria-hidden="true" />
                  {t.annuleeTexte}
                </p>
              )}
            </section>

            <section className="panneau">
              <h2 className="panneau-titre">{t.detail}</h2>
              <dl className="commande-detail">
                <div><dt>{t.article}</dt><dd>{fcfa(commande.montant_oeuvre)}</dd></div>
                <div>
                  <dt>{t.livraison}</dt>
                  <dd>{commande.frais_livraison === 0 ? t.gratuite : fcfa(commande.frais_livraison)}</dd>
                </div>
                <div className="commande-detail-total">
                  <dt>{t.total}</dt><dd>{fcfa(commande.montant_total)}</dd>
                </div>
              </dl>

              <p className="commande-adresse">
                {commande.destinataire} · {commande.telephone}<br />
                {commande.adresse}, {commande.ville}
              </p>

              <p className="tableau-second">
                {t.commandeeLe(dateCourte(commande.created_at, langue))}
                {commande.mode_paiement === 'livraison' && t.aLaLivraison}
                {commande.paye_le && t.payeeLe(dateCourte(commande.paye_le, langue))}
              </p>
            </section>

            {commande.mode_paiement === 'livraison' && commande.statut !== 'annulee' && (
              <div className="console-note">
                <HandCoins size={16} aria-hidden="true" />
                <p>
                  {t.reglezAvant} <strong>{fcfa(commande.montant_total)}</strong> {t.reglezApres}
                </p>
              </div>
            )}

            {aRegler && paiement.actif && (
              <section className="panneau">
                <h2 className="panneau-titre">{t.regler(fcfa(commande.montant_total))}</h2>

                {lien ? (
                  <>
                    <p className="tableau-second" style={{ marginBottom: 'var(--space-3)' }}>
                      {!mobile && methode !== 'carte' ? t.scannez : t.validez}
                    </p>
                    {!mobile && methode !== 'carte' ? (
                      <div className="tunnel-qr">
                        <CodeQR valeur={lien} taille={200} />
                      </div>
                    ) : (
                      <a href={lien} className="btn btn-primaire btn-md" style={{ width: '100%', justifyContent: 'center' }}>
                        {methode === 'carte' ? t.rouvrirPage : t.rouvrir}
                      </a>
                    )}
                  </>
                ) : (
                  <form onSubmit={payer} className="achat-champs">
                    <ChampSelection
                      label={t.moyen}
                      value={methode}
                      onChange={(e) => setMethode(e.target.value)}
                    >
                      {paiement.moyens.map((m) => (
                        <option key={m.cle} value={m.cle}>{m.nom}</option>
                      ))}
                    </ChampSelection>

                    <Champ
                      label={t.numero}
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
                      {t.payer(fcfa(commande.montant_total))}
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
                {t.annuler}
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </>
  )
}
