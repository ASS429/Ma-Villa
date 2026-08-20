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

export default function OeuvreDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { boutique, chargee } = useConfig()
  const [imageActive, setImageActive] = useState(0)

  const { donnees: oeuvre, chargement, erreur, reessayer } = useRequete<Oeuvre>(
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

  const photos = oeuvre?.photos ?? []
  const photo = photos[imageActive] ?? photos[0]
  const vendue = oeuvre?.statut === 'vendue'

  // Les frais les plus bas, pour annoncer « à partir de » sans mentir.
  const fraisMini = Math.min(...Object.values(boutique.zones).map((z) => z.frais), 0)

  return (
    <>
      <Seo
        titre={oeuvre ? `${oeuvre.titre} — ${oeuvre.artiste}` : 'Œuvre'}
        description={
          oeuvre
            ? `${oeuvre.titre} par ${oeuvre.artiste}. ${[oeuvre.technique, oeuvre.dimensions].filter(Boolean).join(', ')}. ${fcfa(oeuvre.prix)}.`
            : 'Une œuvre de la boutique Ma Villa.'
        }
        image={photos[0]?.url}
      />
      <Navbar />

      <main className="oeuvre">
        <Link to="/boutique" className="oeuvre-retour">
          <ArrowLeft size={16} aria-hidden="true" />
          Toutes les œuvres
        </Link>

        {erreur && !chargement && (
          <div className="console-erreur" role="alert">
            {erreur}
            <Button variante="secondaire" taille="sm" onClick={reessayer}>Réessayer</Button>
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
                      aria-label={`Voir la photo ${i + 1}`}
                      aria-current={i === imageActive}
                    >
                      <img src={p.url} alt="" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="oeuvre-fiche">
              {vendue && <Badge ton="neutre">Vendue</Badge>}
              <h1 className="oeuvre-titre">{oeuvre.titre}</h1>
              <p className="oeuvre-artiste">{oeuvre.artiste}</p>

              {/* Le cartel, comme en galerie : ce qu'on lit sous une œuvre. */}
              <dl className="oeuvre-cartel">
                {oeuvre.technique && (
                  <div><dt>Technique</dt><dd>{oeuvre.technique}</dd></div>
                )}
                {oeuvre.dimensions && (
                  <div><dt>Dimensions</dt><dd>{oeuvre.dimensions}</dd></div>
                )}
                {oeuvre.annee && (
                  <div><dt>Année</dt><dd>{oeuvre.annee}</dd></div>
                )}
              </dl>

              {oeuvre.description && <p className="oeuvre-description">{oeuvre.description}</p>}

              <div className="oeuvre-achat">
                <p className="oeuvre-prix">{fcfa(oeuvre.prix)}</p>
                <p className="oeuvre-prix-note">
                  {fraisMini === 0
                    ? 'Livraison en sus, ou retrait sur place gratuit.'
                    : 'Frais de livraison en sus, annoncés avant le paiement.'}
                </p>

                {vendue ? (
                  <p className="oeuvre-indisponible">
                    Cette pièce a trouvé preneur. Écrivez-nous si vous cherchez
                    une œuvre du même artiste.
                  </p>
                ) : user ? (
                  <ButtonLink to={`/boutique/${oeuvre.id}/commander`} variante="primaire" bloc>
                    Commander cette œuvre
                  </ButtonLink>
                ) : (
                  <>
                    <ButtonLink
                      to={`/login?retour=/boutique/${oeuvre.id}/commander`}
                      variante="primaire"
                      bloc
                    >
                      Se connecter pour commander
                    </ButtonLink>
                    <p className="oeuvre-prix-note">
                      Un compte permet de suivre votre commande jusqu'à la livraison.
                    </p>
                  </>
                )}
              </div>

              {/* Trois réponses aux trois questions qu'on se pose avant un
                  premier achat en ligne : est-ce unique, comment ça arrive,
                  comment je paie. */}
              <ul className="oeuvre-garanties">
                <li><ShieldCheck size={16} aria-hidden="true" /> Pièce unique, vendue une seule fois</li>
                <li><Truck size={16} aria-hidden="true" /> Livraison à Dakar et en régions</li>
                <li>
                  <Wallet size={16} aria-hidden="true" />
                  Wave, Orange Money{boutique.livraison ? ' ou paiement à la livraison' : ''}
                </li>
              </ul>
            </div>
          </div>
        ) : null}
      </main>

      <Footer />
    </>
  )
}
