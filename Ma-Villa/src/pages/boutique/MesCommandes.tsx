import { Link, Navigate } from 'react-router-dom'
import { ArrowLeft, Inbox, ImageOff } from 'lucide-react'
import api from '../../services/api'
import { useConfig } from '../../context/ConfigContext'
import { useRequete } from '../../lib/useRequete'
import { fcfa, dateCourte } from '../../lib/format'
import type { Commande } from '../../types'
import { METIER } from '../../i18n/metier'
import ChargementPage from '../../components/ChargementPage'
import Seo from '../../components/Seo'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'
import Button, { ButtonLink } from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { useLangue } from '../../i18n/langue'
import { TEXTES_BOUTIQUE } from '../../i18n/boutique'

const TON: Record<Commande['statut'], 'success' | 'warning' | 'danger' | 'neutre'> = {
  en_attente: 'warning',
  confirmee: 'success',
  expediee: 'neutre',
  livree: 'success',
  annulee: 'danger',
}

export default function MesCommandes() {
  const { boutique, chargee } = useConfig()
  const { langue, lien } = useLangue()
  const t = TEXTES_BOUTIQUE[langue].mesCommandes

  const { donnees, chargement, erreur, reessayer } = useRequete<Commande[]>(
    async (signal) => (await api.get('/commandes', { signal })).data,
    'mes-commandes',
    { messageErreurParDefaut: t.chargementImpossible }
  )

  // On attend de **savoir** avant de trancher : au premier rendu la
  // configuration n'est pas encore arrivée, et rediriger à ce moment-là
  // renvoyait à l'accueil alors que la boutique était ouverte.
  if (!chargee) return <ChargementPage />
  // Fermée, elle n'existe pas : ni page, ni URL à garder en mémoire.
  if (!boutique.actif) return <Navigate to={lien('/')} replace />

  const commandes = donnees ?? []

  return (
    <>
      <Seo titre={t.seoTitre} description={t.seoDescription} />
      <Navbar />

      <main className="boutique">
        <Link to={lien('/boutique/')} className="oeuvre-retour">
          <ArrowLeft size={16} aria-hidden="true" />
          {t.retour}
        </Link>

        <h1 className="boutique-titre">{t.titre}</h1>

        {erreur && !chargement && (
          <div className="console-erreur" role="alert">
            {erreur}
            <Button variante="secondaire" taille="sm" onClick={reessayer}>{t.reessayer}</Button>
          </div>
        )}

        {chargement ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {[0, 1].map((n) => <div key={n} className="skeleton" style={{ height: 96, borderRadius: 'var(--r-lg)' }} />)}
          </div>
        ) : commandes.length === 0 ? (
          <div className="console-vide">
            <span className="console-vide-icone"><Inbox size={22} /></span>
            <p>{t.aucune}</p>
            <ButtonLink to={lien('/boutique/')} variante="primaire" taille="sm">{t.voir}</ButtonLink>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {commandes.map((c) => (
              <Link key={c.id} to={lien(`/boutique/commandes/${c.id}`)} className="commande-ligne">
                {c.oeuvre?.photos?.[0] ? (
                  <img src={c.oeuvre.photos[0].url} alt="" className="commande-vignette" loading="lazy" />
                ) : (
                  <span className="commande-vignette carte-oeuvre-vide" aria-hidden="true">
                    <ImageOff size={18} />
                  </span>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="tableau-fort">{c.oeuvre_titre}</p>
                  <p className="tableau-second">{c.oeuvre_artiste}</p>
                  <p className="tableau-second">
                    {dateCourte(c.created_at, langue)}
                    {/* Ce qui reste à faire passe avant l'historique : une
                        commande à régler doit se voir depuis la liste. */}
                    {c.mode_paiement === 'en_ligne'
                      && c.statut_paiement !== 'reussi'
                      && c.statut !== 'annulee'
                      && t.aRegler}
                  </p>
                </div>

                <div className="commande-ligne-droite">
                  <Badge ton={TON[c.statut]}>{METIER[langue].statutCommande[c.statut]}</Badge>
                  <p className="commande-montant">{fcfa(c.montant_total)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </>
  )
}
