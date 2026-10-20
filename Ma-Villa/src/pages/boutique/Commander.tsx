import { useState } from 'react'
import { Navigate, useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Truck, CreditCard, HandCoins } from 'lucide-react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useConfig } from '../../context/ConfigContext'
import { useToast } from '../../context/ToastContext'
import { useRequete } from '../../lib/useRequete'
import { messageErreur } from '../../lib/erreurs'
import { fcfa } from '../../lib/format'
import type { Oeuvre } from '../../types'
import ChargementPage from '../../components/ChargementPage'
import Seo from '../../components/Seo'
import Navbar from '../../components/Navbar'
import Button from '../../components/ui/Button'
import { Champ, ChampZoneTexte } from '../../components/ui/Champ'
import { useLangue } from '../../i18n/langue'
import { TEXTES_BOUTIQUE } from '../../i18n/boutique'

/**
 * Tunnel de commande.
 *
 * Nu, comme le achat de paiement des réservations, et pour la même raison :
 * chaque milliseconde entre un montant et sa validation est un abandon. Pas de
 * pied de page, pas d'animation, un seul chemin.
 *
 * Le total est recalculé à l'écran à chaque changement de zone, mais **ce n'est
 * qu'un affichage** : le serveur refait le calcul, et c'est le sien qui compte.
 */
export default function Commander() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { boutique, chargee, paiement } = useConfig()
  const toast = useToast()
  const navigate = useNavigate()
  const { langue, lien } = useLangue()
  const t = TEXTES_BOUTIQUE[langue].commande
  const zonesEn = TEXTES_BOUTIQUE[langue].zones

  const [zone, setZone] = useState('')
  const [mode, setMode] = useState<'en_ligne' | 'livraison'>('en_ligne')
  const [destinataire, setDestinataire] = useState(user?.name ?? '')
  const [telephone, setTelephone] = useState(user?.phone ?? '')
  const [adresse, setAdresse] = useState('')
  const [ville, setVille] = useState('')
  const [note, setNote] = useState('')
  const [envoi, setEnvoi] = useState(false)

  const { donnees: oeuvre, chargement, erreur } = useRequete<Oeuvre>(
    async (signal) => (await api.get(`/oeuvres/${id}`, { signal })).data,
    `oeuvre-${id}`,
    { messageErreurParDefaut: t.introuvable }
  )

  // On attend de **savoir** avant de trancher : au premier rendu la
  // configuration n'est pas encore arrivée, et rediriger à ce moment-là
  // renvoyait à l'accueil alors que la boutique était ouverte.
  if (!chargee) return <ChargementPage />
  // Fermée, elle n'existe pas : ni page, ni URL à garder en mémoire.
  if (!boutique.actif) return <Navigate to={lien('/')} replace />
  if (!user) return <Navigate to={`${lien('/login')}?retour=${lien(`/boutique/${id}/commander`)}`} replace />

  const zones = Object.entries(boutique.zones)
  const zoneChoisie = zone ? boutique.zones[zone] : null
  const frais = zoneChoisie?.frais ?? 0
  const total = (oeuvre?.prix ?? 0) + frais

  /*
   * Chaque moyen suit sa propre bascule.
   *
   * Paiement en ligne fermé — le cas depuis le 14 septembre 2026, compte
   * PayDunya bloqué —, proposer « Payer maintenant » créait une commande
   * impossible à régler, et l'article quittait la vitrine pour rien. Le choix
   * de l'utilisateur est gardé, mais retombe sur ce qui existe vraiment.
   */
  const enLigne = paiement.actif
  const choix: 'en_ligne' | 'livraison' | null =
    enLigne && mode === 'en_ligne' ? 'en_ligne'
      : boutique.livraison ? 'livraison'
        : enLigne ? 'en_ligne'
          : null

  const complet = choix && zone && destinataire.trim() && telephone.trim() && adresse.trim() && ville.trim()

  const commander = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!complet || envoi) return

    setEnvoi(true)
    try {
      const { data } = await api.post('/commandes', {
        oeuvre_id: Number(id),
        zone_livraison: zone,
        mode_paiement: choix,
        destinataire: destinataire.trim(),
        telephone: telephone.trim(),
        adresse: adresse.trim(),
        ville: ville.trim(),
        note: note.trim() || null,
      })

      toast.succes(t.enregistree)
      navigate(lien(`/boutique/commandes/${data.id}`), { replace: true })
    } catch (err) {
      toast.erreur(messageErreur(err, t.echec))
      setEnvoi(false)
    }
  }

  // Vendue entre-temps : le dire ici plutôt que de laisser remplir un
  // formulaire qui sera refusé à l'envoi.
  const indisponible = oeuvre && oeuvre.statut !== 'publiee'

  return (
    <>
      <Seo titre={t.seoTitre} description={t.seoDescription} />
      <Navbar />

      <main className="achat">
        <Link to={lien(`/boutique/${id}/`)} className="oeuvre-retour">
          <ArrowLeft size={16} aria-hidden="true" />
          {t.retour}
        </Link>

        {erreur && <div className="console-erreur" role="alert">{erreur}</div>}

        {indisponible && (
          <div className="console-erreur" role="alert">
            {t.vendu}
          </div>
        )}

        {chargement ? (
          <div className="skeleton" style={{ height: 320, borderRadius: 'var(--r-lg)' }} />
        ) : oeuvre && !indisponible ? (
          <form className="achat-corps" onSubmit={commander}>
            <section className="panneau">
              <h1 className="panneau-titre">{t.votreCommande}</h1>

              <div className="commande-resume">
                {oeuvre.photos?.[0] && (
                  <img src={oeuvre.photos[0].url} alt="" className="commande-vignette" />
                )}
                <div style={{ minWidth: 0 }}>
                  <p className="tableau-fort">{oeuvre.titre}</p>
                  <p className="tableau-second">{oeuvre.artiste}</p>
                </div>
                <p className="commande-montant">{fcfa(oeuvre.prix)}</p>
              </div>
            </section>

            <section className="panneau">
              <h2 className="panneau-titre"><Truck size={17} aria-hidden="true" /> {t.livraison}</h2>

              <fieldset className="choix-mode">
                <legend className="champ-label">{t.ouLivrer}</legend>
                {zones.map(([cle, z]) => (
                  <label key={cle} className={`choix${zone === cle ? ' est-actif' : ''}`}>
                    <input
                      type="radio"
                      name="zone"
                      value={cle}
                      checked={zone === cle}
                      onChange={() => setZone(cle)}
                    />
                    <span>
                      <span className="choix-titre">{zonesEn[cle]?.nom ?? z.nom} · {z.frais === 0 ? t.gratuit : fcfa(z.frais)}</span>
                      <span className="choix-aide">{zonesEn[cle]?.delai ?? z.delai}</span>
                    </span>
                  </label>
                ))}
              </fieldset>

              <div className="achat-champs">
                <Champ
                  label={t.destinataire}
                  value={destinataire}
                  onChange={(e) => setDestinataire(e.target.value)}
                  maxLength={120}
                  required
                />
                <Champ
                  label={t.telephone}
                  type="tel"
                  aide={t.telephoneAide}
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  maxLength={30}
                  required
                />
                <Champ
                  label={t.ville}
                  value={ville}
                  onChange={(e) => setVille(e.target.value)}
                  maxLength={120}
                  required
                />
                <ChampZoneTexte
                  label={t.adresse}
                  aide={t.adresseAide}
                  rows={2}
                  value={adresse}
                  onChange={(e) => setAdresse(e.target.value)}
                  maxLength={500}
                  required
                />
                <ChampZoneTexte
                  label={t.precision}
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                />
              </div>
            </section>

            <section className="panneau">
              <h2 className="panneau-titre">{t.reglement}</h2>

              <fieldset className="choix-mode">
                <legend className="sr-only">{t.commentPayer}</legend>
                {enLigne && (
                  <label className={`choix${choix === 'en_ligne' ? ' est-actif' : ''}`}>
                    <input
                      type="radio" name="mode" value="en_ligne"
                      checked={choix === 'en_ligne'} onChange={() => setMode('en_ligne')}
                    />
                    <span>
                      <span className="choix-titre">
                        <CreditCard size={14} aria-hidden="true" /> {t.payerMaintenant}
                      </span>
                      <span className="choix-aide">{t.payerMaintenantAide}</span>
                    </span>
                  </label>
                )}

                {boutique.livraison && (
                  <label className={`choix${choix === 'livraison' ? ' est-actif' : ''}`}>
                    <input
                      type="radio" name="mode" value="livraison"
                      checked={choix === 'livraison'} onChange={() => setMode('livraison')}
                    />
                    <span>
                      <span className="choix-titre">
                        <HandCoins size={14} aria-hidden="true" /> {t.payerLivraison}
                      </span>
                      <span className="choix-aide">{t.payerLivraisonAide}</span>
                    </span>
                  </label>
                )}
              </fieldset>

              {/* Dire pourquoi il n'y a qu'un choix, sinon on le cherche. */}
              {!enLigne && boutique.livraison && (
                <p className="achat-note">
                  {t.enLigneIndisponible}
                </p>
              )}
              {choix === null && (
                <p className="achat-note">{t.aucunMoyen}</p>
              )}
            </section>

            {/* Le total est visible au moment de valider, jamais après : des
                frais découverts ensuite sont la première cause d'abandon. */}
            <div className="achat-total">
              <dl>
                <div><dt>{t.article}</dt><dd>{fcfa(oeuvre.prix)}</dd></div>
                <div>
                  <dt>{t.livraison}</dt>
                  <dd>{zone ? (frais === 0 ? t.gratuite : fcfa(frais)) : '—'}</dd>
                </div>
                <div className="achat-total-ligne">
                  <dt>{t.total}</dt>
                  <dd>{zone ? fcfa(total) : '—'}</dd>
                </div>
              </dl>

              <Button
                type="submit"
                variante="primaire"
                bloc
                disabled={!complet || envoi}
                chargement={envoi}
              >
                {choix === 'en_ligne' ? t.validerPayer : t.valider}
              </Button>

              {!zone && <p className="achat-note">{t.choisirZone}</p>}
            </div>
          </form>
        ) : null}
      </main>
    </>
  )
}
