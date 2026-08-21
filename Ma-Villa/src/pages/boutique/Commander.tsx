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
  const { boutique, chargee } = useConfig()
  const toast = useToast()
  const navigate = useNavigate()

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
    { messageErreurParDefaut: 'Cette œuvre est introuvable.' }
  )

  // On attend de **savoir** avant de trancher : au premier rendu la
  // configuration n'est pas encore arrivée, et rediriger à ce moment-là
  // renvoyait à l'accueil alors que la boutique était ouverte.
  if (!chargee) return <ChargementPage />
  // Fermée, elle n'existe pas : ni page, ni URL à garder en mémoire.
  if (!boutique.actif) return <Navigate to="/" replace />
  if (!user) return <Navigate to={`/login?retour=/boutique/${id}/commander`} replace />

  const zones = Object.entries(boutique.zones)
  const zoneChoisie = zone ? boutique.zones[zone] : null
  const frais = zoneChoisie?.frais ?? 0
  const total = (oeuvre?.prix ?? 0) + frais

  const complet = zone && destinataire.trim() && telephone.trim() && adresse.trim() && ville.trim()

  const commander = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!complet || envoi) return

    setEnvoi(true)
    try {
      const { data } = await api.post('/commandes', {
        oeuvre_id: Number(id),
        zone_livraison: zone,
        mode_paiement: mode,
        destinataire: destinataire.trim(),
        telephone: telephone.trim(),
        adresse: adresse.trim(),
        ville: ville.trim(),
        note: note.trim() || null,
      })

      toast.succes('Commande enregistrée.')
      navigate(`/boutique/commandes/${data.id}`, { replace: true })
    } catch (err) {
      toast.erreur(messageErreur(err, "La commande n'a pas pu être enregistrée."))
      setEnvoi(false)
    }
  }

  // Vendue entre-temps : le dire ici plutôt que de laisser remplir un
  // formulaire qui sera refusé à l'envoi.
  const indisponible = oeuvre && oeuvre.statut !== 'publiee'

  return (
    <>
      <Seo titre="Commander une œuvre" description="Finalisez votre commande." />
      <Navbar />

      <main className="achat">
        <Link to={`/boutique/${id}`} className="oeuvre-retour">
          <ArrowLeft size={16} aria-hidden="true" />
          Retour à l'œuvre
        </Link>

        {erreur && <div className="console-erreur" role="alert">{erreur}</div>}

        {indisponible && (
          <div className="console-erreur" role="alert">
            Cette œuvre vient d'être vendue. Elle n'est plus disponible.
          </div>
        )}

        {chargement ? (
          <div className="skeleton" style={{ height: 320, borderRadius: 'var(--r-lg)' }} />
        ) : oeuvre && !indisponible ? (
          <form className="achat-corps" onSubmit={commander}>
            <section className="panneau">
              <h1 className="panneau-titre">Votre commande</h1>

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
              <h2 className="panneau-titre"><Truck size={17} aria-hidden="true" /> Livraison</h2>

              <fieldset className="choix-mode">
                <legend className="champ-label">Où livrer</legend>
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
                      <span className="choix-titre">{z.nom} · {z.frais === 0 ? 'gratuit' : fcfa(z.frais)}</span>
                      <span className="choix-aide">{z.delai}</span>
                    </span>
                  </label>
                ))}
              </fieldset>

              <div className="achat-champs">
                <Champ
                  label="Destinataire"
                  value={destinataire}
                  onChange={(e) => setDestinataire(e.target.value)}
                  maxLength={120}
                  required
                />
                <Champ
                  label="Téléphone"
                  type="tel"
                  aide="Pour vous joindre le jour de la livraison."
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  maxLength={30}
                  required
                />
                <Champ
                  label="Ville"
                  value={ville}
                  onChange={(e) => setVille(e.target.value)}
                  maxLength={120}
                  required
                />
                <ChampZoneTexte
                  label="Adresse"
                  aide="Quartier, rue, point de repère."
                  rows={2}
                  value={adresse}
                  onChange={(e) => setAdresse(e.target.value)}
                  maxLength={500}
                  required
                />
                <ChampZoneTexte
                  label="Précision (facultatif)"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                />
              </div>
            </section>

            <section className="panneau">
              <h2 className="panneau-titre">Règlement</h2>

              <fieldset className="choix-mode">
                <legend className="sr-only">Comment payer</legend>
                <label className={`choix${mode === 'en_ligne' ? ' est-actif' : ''}`}>
                  <input
                    type="radio" name="mode" value="en_ligne"
                    checked={mode === 'en_ligne'} onChange={() => setMode('en_ligne')}
                  />
                  <span>
                    <span className="choix-titre">
                      <CreditCard size={14} aria-hidden="true" /> Payer maintenant
                    </span>
                    <span className="choix-aide">Wave ou Orange Money, depuis votre téléphone.</span>
                  </span>
                </label>

                {boutique.livraison && (
                  <label className={`choix${mode === 'livraison' ? ' est-actif' : ''}`}>
                    <input
                      type="radio" name="mode" value="livraison"
                      checked={mode === 'livraison'} onChange={() => setMode('livraison')}
                    />
                    <span>
                      <span className="choix-titre">
                        <HandCoins size={14} aria-hidden="true" /> Payer à la livraison
                      </span>
                      <span className="choix-aide">Vous réglez en main propre à la remise de l'œuvre.</span>
                    </span>
                  </label>
                )}
              </fieldset>
            </section>

            {/* Le total est visible au moment de valider, jamais après : des
                frais découverts ensuite sont la première cause d'abandon. */}
            <div className="achat-total">
              <dl>
                <div><dt>Œuvre</dt><dd>{fcfa(oeuvre.prix)}</dd></div>
                <div>
                  <dt>Livraison</dt>
                  <dd>{zone ? (frais === 0 ? 'Gratuite' : fcfa(frais)) : '—'}</dd>
                </div>
                <div className="achat-total-ligne">
                  <dt>Total</dt>
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
                {mode === 'en_ligne' ? 'Valider et payer' : 'Valider la commande'}
              </Button>

              {!zone && <p className="achat-note">Choisissez une zone de livraison pour voir le total.</p>}
            </div>
          </form>
        ) : null}
      </main>
    </>
  )
}
