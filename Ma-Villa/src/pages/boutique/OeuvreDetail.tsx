import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, ImageOff, ShieldCheck, Truck, Wallet } from 'lucide-react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useConfig } from '../../context/ConfigContext'
import { useRequete } from '../../lib/useRequete'
import { fcfa } from '../../lib/format'
import type { Oeuvre } from '../../types'
import ChargementPage from '../../components/ChargementPage'
import Seo from '../../components/Seo'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'
import Button, { ButtonLink } from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { useLangue } from '../../i18n/langue'
import { TEXTES_BOUTIQUE } from '../../i18n/boutique'

export default function OeuvreDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { boutique, chargee, paiement } = useConfig()
  const { langue, lien } = useLangue()
  const t = TEXTES_BOUTIQUE[langue].article
  // Même règle que la vitrine : seuls les moyens ouverts sont annoncés.
  const moyens = paiement.actif
    ? t.moyensEnLigne(boutique.livraison)
    : boutique.livraison ? t.moyensLivraison : t.moyensBientot
  const [imageActive, setImageActive] = useState(0)

  const { donnees: oeuvre, chargement, erreur, reessayer } = useRequete<Oeuvre>(
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

  const photos = oeuvre?.photos ?? []
  const photo = photos[imageActive] ?? photos[0]
  const vendue = oeuvre?.statut === 'vendue'

  // Les frais les plus bas, pour annoncer « à partir de » sans mentir.
  const fraisMini = Math.min(...Object.values(boutique.zones).map((z) => z.frais), 0)

  return (
    <>
      <Seo
        titre={oeuvre ? `${oeuvre.titre} — ${oeuvre.artiste}` : t.seoArticle}
        description={
          oeuvre
            ? `${t.seoPar(oeuvre.titre, oeuvre.artiste)} ${[oeuvre.technique, oeuvre.dimensions].filter(Boolean).join(', ')}. ${fcfa(oeuvre.prix)}.`
            : t.seoDefaut
        }
        image={photos[0]?.url}
        chemin={lien(`/boutique/${id}/`)}
      />
      <Navbar />

      <div className="oeuvre">
        <Link to={lien('/boutique/')} className="oeuvre-retour">
          <ArrowLeft size={16} aria-hidden="true" />
          {t.tous}
        </Link>

        {erreur && !chargement && (
          <div className="console-erreur" role="alert">
            {erreur}
            <Button variante="secondaire" taille="sm" onClick={reessayer}>{t.reessayer}</Button>
          </div>
        )}

        {chargement ? (
          <div className="oeuvre-corps">
            <div className="skeleton" style={{ aspectRatio: '4 / 5', borderRadius: 'var(--r-lg)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="skeleton" style={{ height: 34, width: '70%', borderRadius: 8 }} />
              <div className="skeleton" style={{ height: 18, width: '40%', borderRadius: 6 }} />
              <div className="skeleton" style={{ height: 90, borderRadius: 8 }} />
            </div>
          </div>
        ) : oeuvre ? (
          <div className="oeuvre-corps">
            <div className="oeuvre-images">
              <div className={`oeuvre-image${vendue ? ' est-vendue' : ''}`}>
                {photo ? (
                  <img src={photo.url} alt={photo.alt || `${oeuvre.titre}, ${oeuvre.artiste}`} />
                ) : (
                  <div className="carte-oeuvre-vide" aria-hidden="true"><ImageOff size={28} /></div>
                )}
              </div>

              {/* Les vignettes n'apparaissent que s'il y a de quoi choisir. */}
              {photos.length > 1 && (
                <div className="oeuvre-vignettes">
                  {photos.map((p, i) => (
                    <button
                      key={p.url}
                      type="button"
                      className={`oeuvre-vignette${i === imageActive ? ' est-active' : ''}`}
                      onClick={() => setImageActive(i)}
                      aria-label={t.voirPhoto(i + 1)}
                      aria-current={i === imageActive}
                    >
                      <img src={p.url} alt="" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="oeuvre-fiche">
              {vendue && <Badge ton="neutre">{t.vendue}</Badge>}
              <h1 className="oeuvre-titre">{oeuvre.titre}</h1>
              <p className="oeuvre-artiste">{oeuvre.artiste}</p>

              {/* Le cartel, comme en galerie : ce qu'on lit sous un article. */}
              <dl className="oeuvre-cartel">
                {oeuvre.technique && (
                  <div><dt>{t.technique}</dt><dd>{oeuvre.technique}</dd></div>
                )}
                {oeuvre.dimensions && (
                  <div><dt>{t.dimensions}</dt><dd>{oeuvre.dimensions}</dd></div>
                )}
                {oeuvre.annee && (
                  <div><dt>{t.annee}</dt><dd>{oeuvre.annee}</dd></div>
                )}
                {/* La disponibilité se lit dans le cartel, pas dans un bandeau :
                    pour un article fait main, la quantité fait partie de sa
                    description au même titre que ses dimensions. */}
                {!vendue && (
                  <div>
                    <dt>{t.disponibilite}</dt>
                    <dd>
                      {oeuvre.stock === 1
                        ? t.pieceUnique
                        : t.exemplaires(oeuvre.stock)}
                    </dd>
                  </div>
                )}
              </dl>

              {oeuvre.description && <p className="oeuvre-description">{oeuvre.description}</p>}

              <div className="oeuvre-achat">
                <p className="oeuvre-prix">{fcfa(oeuvre.prix)}</p>
                <p className="oeuvre-prix-note">
                  {fraisMini === 0
                    ? t.livraisonRetrait
                    : t.livraisonEnSus}
                </p>

                {vendue ? (
                  <p className="oeuvre-indisponible">
                    {oeuvre.stock === 0 && oeuvre.categorie === 'tableaux'
                      ? t.preneur
                      : t.epuise}
                  </p>
                ) : user ? (
                  <ButtonLink to={lien(`/boutique/${oeuvre.id}/commander`)} variante="primaire" bloc>
                    {t.commander}
                  </ButtonLink>
                ) : (
                  <>
                    <ButtonLink
                      to={`${lien('/login')}?retour=${lien(`/boutique/${oeuvre.id}/commander`)}`}
                      variante="primaire"
                      bloc
                    >
                      {t.seConnecter}
                    </ButtonLink>
                    <p className="oeuvre-prix-note">
                      {t.compte}
                    </p>
                  </>
                )}
              </div>

              {/* Trois réponses aux trois questions qu'on se pose avant un
                  premier achat en ligne : est-ce unique, comment ça arrive,
                  comment je paie. */}
              <ul className="oeuvre-garanties">
                <li>
                  <ShieldCheck size={16} aria-hidden="true" />
                  {oeuvre.stock === 1
                    ? t.garantieUnique
                    : t.garantieMain}
                </li>
                <li><Truck size={16} aria-hidden="true" /> {t.garantieLivraison}</li>
                <li>
                  <Wallet size={16} aria-hidden="true" />
                  {moyens}
                </li>
              </ul>
            </div>
          </div>
        ) : null}
      </div>

      <Footer />
    </>
  )
}
