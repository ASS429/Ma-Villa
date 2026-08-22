import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check, MapPin, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import api from '../../services/api'
import { messageErreur } from '../../lib/erreurs'
import { fcfa } from '../../lib/format'
import TeleverseurPhotos from '../../components/console/TeleverseurPhotos'
import Button from '../../components/ui/Button'
import { useToast } from '../../context/ToastContext'
import {
  LIBELLES_LOGEMENT, LIBELLES_TARIF,
  type Photo, type TypeLogement, type TypeTarif,
} from '../../types'

/* ── Les étapes ──────────────────────────────────────────────── */

type CleEtape = 'villa' | 'photos' | 'adresse' | 'logement' | 'prix' | 'description'

interface Etape {
  cle: CleEtape
  titre: string
  /** Ce qu'on gagne à la remplir — jamais ce qu'on risque à l'omettre. */
  aide: string
  /** Seule la première ne peut pas être sautée : sans elle, rien à enregistrer. */
  obligatoire?: boolean
  minutes: number
}

const ETAPES: Etape[] = [
  {
    cle: 'villa',
    titre: 'Votre bien',
    aide: 'Son nom et sa ville. C\'est tout ce qu\'il faut pour commencer — le reste s\'ajoute ensuite, et rien ne se perd.',
    obligatoire: true,
    minutes: 1,
  },
  {
    cle: 'photos',
    titre: 'Les photos',
    aide: 'Une photo du séjour et une de l\'extérieur suffisent à donner envie. Les fichiers lourds sont allégés automatiquement.',
    minutes: 3,
  },
  {
    cle: 'adresse',
    titre: 'Où et comment vous joindre',
    aide: 'L\'adresse n\'apparaît qu\'au client qui a réservé et payé. Votre numéro, jamais avant.',
    minutes: 2,
  },
  {
    cle: 'logement',
    titre: 'Ce que vous louez',
    aide: 'La villa entière, une chambre, ou la piscine seule à la journée. Vous pourrez en ajouter d\'autres après publication.',
    minutes: 2,
  },
  {
    cle: 'prix',
    titre: 'Votre tarif',
    aide: 'Un seul suffit pour publier. Les autres formules — avec climatisation, avec buffet — s\'ajoutent ensuite.',
    minutes: 2,
  },
  {
    cle: 'description',
    titre: 'La description',
    aide: 'Quelques phrases sur ce qui rend l\'endroit agréable. C\'est ce que le client lit avant de vous écrire.',
    minutes: 3,
  },
]

/* ── Ce que le serveur renvoie ───────────────────────────────── */

interface Reperes {
  comparable: boolean
  annonces: number
  bas?: number
  haut?: number
  median?: number
  net?: { proprietaire: number; commission: number; taux: number } | null
}

interface Manque { etape: CleEtape; message: string }

/* ── L'écran ─────────────────────────────────────────────────── */

/**
 * Publier une villa.
 *
 * **Le seul écran dont l'échec se mesure en annonces qui n'existent pas.** Un
 * propriétaire qui abandonne au milieu ne revient pas, et personne ne vient se
 * plaindre d'une annonce qu'il n'a pas créée : la perte est invisible.
 *
 * Tout ici sert donc à rendre l'abandon **réversible** plutôt qu'à l'empêcher :
 *
 *   — **on commence avec un nom et une ville.** Le brouillon existe dès la
 *     première étape, invisible du public et absent de la file de modération ;
 *   — **chaque étape s'enregistre en la quittant.** Fermer l'onglet ne coûte
 *     rien, et l'adresse porte l'identifiant du brouillon pour y revenir ;
 *   — **la progression compte les étapes restantes**, pas un pourcentage :
 *     « il reste 4 étapes, environ 10 minutes » se vérifie, « 33 % » ne veut
 *     rien dire ;
 *   — **tout se saute sauf la première.** L'annonce reste en brouillon, mais
 *     le travail est sauvé ;
 *   — **le prix montre le net avant tout.** C'est l'étape où l'on hésite le
 *     plus, et celle où la commission se découvrirait sinon après coup.
 */
export default function NouvelleVilla() {
  const naviguer = useNavigate()
  const toast = useToast()
  const [parametres, setParametres] = useSearchParams()

  const [index, setIndex] = useState(0)
  const [villaId, setVillaId] = useState<number | null>(
    parametres.get('brouillon') ? Number(parametres.get('brouillon')) : null
  )
  const [logementId, setLogementId] = useState<number | null>(null)
  const [photos, setPhotos] = useState<(Photo & { id?: number })[]>([])
  const [enregistre, setEnregistre] = useState(false)
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')
  const [manques, setManques] = useState<Manque[]>([])
  const [reperes, setReperes] = useState<Reperes | null>(null)

  const [villa, setVilla] = useState({
    nom: '', ville: '', adresse: '', telephone: '', description: '',
    latitude: '', longitude: '',
  })
  const [logement, setLogement] = useState({
    nom: '', type: 'villa_entiere' as TypeLogement, capacite: '4',
  })
  const [tarif, setTarif] = useState({
    type_tarif: 'nuitee' as TypeTarif, prix: '', avec_clim: false, avec_buffet: false,
  })

  const etape = ETAPES[index]
  const restantes = ETAPES.length - index - 1
  const minutesRestantes = ETAPES.slice(index + 1).reduce((s, e) => s + e.minutes, 0)

  /* ── Reprendre un brouillon ─────────────────────────────────── */

  useEffect(() => {
    if (!villaId) return

    let vivant = true
    api.get(`/villas/${villaId}`)
      .then((r) => {
        if (!vivant) return
        const v = r.data
        setVilla({
          nom: v.nom ?? '', ville: v.ville ?? '', adresse: v.adresse ?? '',
          telephone: v.telephone ?? '', description: v.description ?? '',
          latitude: v.latitude ?? '', longitude: v.longitude ?? '',
        })
        setPhotos(v.photos ?? [])
        const premier = v.logements?.[0]
        if (premier) {
          setLogementId(premier.id)
          setLogement({ nom: premier.nom, type: premier.type, capacite: String(premier.capacite) })
          const t = premier.tarifs?.[0]
          if (t) {
            setTarif({
              type_tarif: t.type_tarif, prix: String(t.prix),
              avec_clim: !!t.avec_clim, avec_buffet: !!t.avec_buffet,
            })
          }
        }
      })
      .catch(() => { /* brouillon disparu : on repart de zéro */ })

    return () => { vivant = false }
    // Une seule fois, à l'arrivée : les rechargements suivants écraseraient
    // la saisie en cours par ce que le serveur a enregistré avant elle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Les repères de prix ────────────────────────────────────── */

  const chargerReperes = useCallback(() => {
    if (!villa.ville) return

    // La formule et le type de logement resserrent la comparaison : sans
    // eux, la fourchette mettrait une piscine à la journée et une villa
    // entière dans le même sac. Le chiffre serait exact et le conseil faux.
    api.get('/reperes-de-prix', {
      params: {
        ville: villa.ville,
        prix: tarif.prix || undefined,
        type_tarif: tarif.type_tarif,
        type_logement: logement.type,
      },
    })
      .then((r) => setReperes(r.data))
      .catch(() => setReperes(null))
  }, [villa.ville, tarif.prix, tarif.type_tarif, logement.type])

  useEffect(() => {
    if (etape.cle !== 'prix') return
    // Le net se recalcule pendant la frappe, mais pas à chaque caractère :
    // un chiffre qui saute à chaque touche se lit comme une erreur.
    const minuteur = setTimeout(chargerReperes, 400)
    return () => clearTimeout(minuteur)
  }, [etape.cle, chargerReperes])

  /* ── Enregistrer l'étape courante ───────────────────────────── */

  async function enregistrerEtape(): Promise<boolean> {
    setErreur('')
    setOccupe(true)

    try {
      if (etape.cle === 'villa') {
        if (!villa.nom.trim() || !villa.ville.trim()) {
          setErreur('Le nom et la ville sont nécessaires pour enregistrer votre brouillon.')
          return false
        }

        if (villaId) {
          await api.put(`/villas/${villaId}`, { nom: villa.nom, ville: villa.ville })
        } else {
          const { data } = await api.post('/villas', { nom: villa.nom, ville: villa.ville })
          setVillaId(data.id)
          // L'identifiant passe dans l'adresse : fermer l'onglet et revenir
          // par l'historique retrouve le brouillon.
          setParametres({ brouillon: String(data.id) }, { replace: true })
        }
      }

      if (etape.cle === 'adresse' && villaId) {
        await api.put(`/villas/${villaId}`, {
          nom: villa.nom, ville: villa.ville,
          adresse: villa.adresse || null,
          telephone: villa.telephone || null,
          latitude: villa.latitude || null,
          longitude: villa.longitude || null,
        })
      }

      if (etape.cle === 'description' && villaId) {
        await api.put(`/villas/${villaId}`, {
          nom: villa.nom, ville: villa.ville, description: villa.description || null,
        })
      }

      if (etape.cle === 'logement' && villaId && logement.nom.trim()) {
        const charge = {
          nom: logement.nom,
          type: logement.type,
          capacite: Number(logement.capacite) || 1,
          disponible: true,
        }

        if (logementId) {
          await api.put(`/villas/${villaId}/logements/${logementId}`, charge)
        } else {
          const { data } = await api.post(`/villas/${villaId}/logements`, charge)
          setLogementId(data.id)
        }
      }

      if (etape.cle === 'prix' && logementId && tarif.prix) {
        await api.post(`/logements/${logementId}/tarifs`, {
          type_tarif: tarif.type_tarif,
          prix: Number(tarif.prix),
          avec_clim: tarif.avec_clim,
          avec_buffet: tarif.avec_buffet,
        })
      }

      setEnregistre(true)
      return true
    } catch (e) {
      setErreur(messageErreur(e, "Cette étape n'a pas pu être enregistrée."))
      return false
    } finally {
      setOccupe(false)
    }
  }

  async function suivant() {
    if (!(await enregistrerEtape())) return
    if (index < ETAPES.length - 1) setIndex(index + 1)
  }

  async function passer() {
    // Passer enregistre quand même ce qui a été saisi : sauter une étape ne
    // doit jamais jeter ce qu'on venait d'y écrire.
    await enregistrerEtape()
    if (index < ETAPES.length - 1) setIndex(index + 1)
  }

  async function publier() {
    if (!villaId) return
    if (!(await enregistrerEtape())) return

    setOccupe(true)
    setManques([])

    try {
      await api.post(`/villas/${villaId}/publier`)
      toast.succes('Annonce envoyée à la validation.')
      naviguer('/dashboard/villas')
    } catch (e) {
      const donnees = (e as { response?: { data?: { manques?: Manque[] } } }).response?.data
      if (donnees?.manques?.length) {
        setManques(donnees.manques)
        setErreur('')
      } else {
        setErreur(messageErreur(e, "L'annonce n'a pas pu être envoyée."))
      }
    } finally {
      setOccupe(false)
    }
  }

  function localiser() {
    if (!navigator.geolocation) {
      setErreur("Votre navigateur ne donne pas la position.")
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => setVilla((v) => ({
        ...v,
        latitude: p.coords.latitude.toFixed(6),
        longitude: p.coords.longitude.toFixed(6),
      })),
      () => setErreur("La position n'a pas pu être obtenue.")
    )
  }

  const rechargerPhotos = useCallback(() => {
    if (!villaId) return
    api.get(`/villas/${villaId}`).then((r) => setPhotos(r.data.photos ?? [])).catch(() => {})
  }, [villaId])

  /* ── Rendu ──────────────────────────────────────────────────── */

  return (
    <div className="publication">
      <header className="publication-entete">
        <div>
          <h1 className="console-titre">Publier une villa</h1>
          <p className="console-sous-titre">
            {restantes === 0
              ? 'Dernière étape.'
              : `Il reste ${restantes} étape${restantes > 1 ? 's' : ''}, environ ${minutesRestantes} minutes.`}
            {' '}Vous pouvez vous arrêter à tout moment.
          </p>
        </div>

        {/* La preuve que rien n'est perdu. Sans elle, « enregistré » est une
            promesse ; avec elle, c'est un constat. */}
        {enregistre && villaId && (
          <p className="publication-brouillon">
            <Check size={14} aria-hidden="true" />
            Brouillon enregistré
          </p>
        )}
      </header>

      <div className="publication-corps">
        {/* ── Le chemin ───────────────────────────────────────── */}
        <ol className="publication-etapes">
          {ETAPES.map((e, i) => (
            <li
              key={e.cle}
              className={`publication-etape${i === index ? ' est-courante' : ''}${i < index ? ' est-faite' : ''}`}
            >
              <span className="publication-puce" aria-hidden="true">
                {i < index ? <Check size={13} /> : i + 1}
              </span>
              <span>{e.titre}</span>
            </li>
          ))}
        </ol>

        {/* ── La question du moment ───────────────────────────── */}
        <section className="publication-panneau">
          <h2 className="publication-titre">{etape.titre}</h2>
          <p className="publication-aide">{etape.aide}</p>

          {erreur && <p className="publication-erreur" role="alert">{erreur}</p>}

          {etape.cle === 'villa' && (
            <div className="publication-champs">
              <label className="champ">
                <span>Nom de l'annonce</span>
                <input
                  value={villa.nom}
                  onChange={(e) => setVilla({ ...villa, nom: e.target.value })}
                  placeholder="Villa Baobab"
                  autoFocus
                />
              </label>
              <label className="champ">
                <span>Ville</span>
                <input
                  value={villa.ville}
                  onChange={(e) => setVilla({ ...villa, ville: e.target.value })}
                  placeholder="Saly"
                />
              </label>
            </div>
          )}

          {etape.cle === 'photos' && (
            villaId ? (
              <TeleverseurPhotos
                photos={photos}
                cheminAjout={`/villas/${villaId}/photos`}
                cheminSuppression={(id) => `/villas/${villaId}/photos/${id}`}
                onChange={rechargerPhotos}
              />
            ) : (
              <p className="publication-aide">Enregistrez d'abord le nom de votre bien.</p>
            )
          )}

          {etape.cle === 'adresse' && (
            <div className="publication-champs">
              <label className="champ">
                <span>Adresse</span>
                <input
                  value={villa.adresse}
                  onChange={(e) => setVilla({ ...villa, adresse: e.target.value })}
                  placeholder="Route de Ngaparou"
                />
              </label>
              <label className="champ">
                <span>Votre numéro</span>
                <input
                  type="tel"
                  inputMode="tel"
                  value={villa.telephone}
                  onChange={(e) => setVilla({ ...villa, telephone: e.target.value })}
                  placeholder="+221 77 123 45 67"
                />
              </label>

              <div className="publication-position">
                <Button variante="secondaire" taille="sm" onClick={localiser} type="button">
                  <MapPin size={15} aria-hidden="true" /> Utiliser ma position
                </Button>
                {villa.latitude && villa.longitude && (
                  <span className="publication-position-lue">
                    Position enregistrée · {Number(villa.latitude).toFixed(4)}, {Number(villa.longitude).toFixed(4)}
                  </span>
                )}
              </div>
            </div>
          )}

          {etape.cle === 'logement' && (
            <div className="publication-champs">
              <label className="champ">
                <span>Ce qu'on réserve</span>
                <select
                  value={logement.type}
                  onChange={(e) => setLogement({ ...logement, type: e.target.value as TypeLogement })}
                >
                  {(Object.keys(LIBELLES_LOGEMENT) as TypeLogement[]).map((t) => (
                    <option key={t} value={t}>{LIBELLES_LOGEMENT[t]}</option>
                  ))}
                </select>
              </label>
              <label className="champ">
                <span>Nom du logement</span>
                <input
                  value={logement.nom}
                  onChange={(e) => setLogement({ ...logement, nom: e.target.value })}
                  placeholder={LIBELLES_LOGEMENT[logement.type]}
                />
              </label>
              <label className="champ">
                <span>Capacité</span>
                <input
                  type="number"
                  min={1}
                  value={logement.capacite}
                  onChange={(e) => setLogement({ ...logement, capacite: e.target.value })}
                />
              </label>
            </div>
          )}

          {etape.cle === 'prix' && (
            <div className="publication-champs">
              <label className="champ">
                <span>Formule</span>
                <select
                  value={tarif.type_tarif}
                  onChange={(e) => setTarif({ ...tarif, type_tarif: e.target.value as TypeTarif })}
                >
                  {(Object.keys(LIBELLES_TARIF) as TypeTarif[]).map((t) => (
                    <option key={t} value={t}>{LIBELLES_TARIF[t]}</option>
                  ))}
                </select>
              </label>

              <label className="champ">
                <span>Prix affiché au client (FCFA)</span>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={tarif.prix}
                  onChange={(e) => setTarif({ ...tarif, prix: e.target.value })}
                  placeholder="85000"
                />
              </label>

              <div className="publication-options">
                <label className="publication-option">
                  <input
                    type="checkbox"
                    checked={tarif.avec_clim}
                    onChange={(e) => setTarif({ ...tarif, avec_clim: e.target.checked })}
                  />
                  Climatisation comprise
                </label>
                <label className="publication-option">
                  <input
                    type="checkbox"
                    checked={tarif.avec_buffet}
                    onChange={(e) => setTarif({ ...tarif, avec_buffet: e.target.checked })}
                  />
                  Buffet compris
                </label>
              </div>

              {/* Le net d'abord, la fourchette ensuite. Le net est vrai
                  partout ; la fourchette ne l'est qu'au-delà d'un certain
                  nombre d'annonces comparables. */}
              {reperes?.net && (
                <p className="publication-net">
                  <strong>Vous toucherez {fcfa(reperes.net.proprietaire)}</strong>
                  <span>
                    {' '}par réservation. La plateforme retient {fcfa(reperes.net.commission)},
                    soit {String(reperes.net.taux).replace('.', ',')} %.
                  </span>
                </p>
              )}

              {reperes?.comparable && reperes.bas && reperes.haut ? (
                <p className="publication-repere">
                  À {villa.ville}, {LIBELLES_LOGEMENT[logement.type].toLowerCase()} en{' '}
                  {LIBELLES_TARIF[tarif.type_tarif].toLowerCase()} se loue entre{' '}
                  <strong>{fcfa(reperes.bas)}</strong> et <strong>{fcfa(reperes.haut)}</strong>,
                  sur {reperes.annonces} annonces.
                </p>
              ) : reperes && !reperes.comparable ? (
                // Dire qu'on ne sait pas vaut mieux qu'une moyenne inventée :
                // à Ziguinchor avec neuf villas, une fourchette est fausse, et
                // c'est nous qui l'aurions soufflée.
                <p className="publication-repere est-muet">
                  Trop peu d'annonces à {villa.ville} pour donner une fourchette fiable.
                  Fixez le prix que vous pratiquez déjà.
                </p>
              ) : null}
            </div>
          )}

          {etape.cle === 'description' && (
            <label className="champ">
              <span>Description</span>
              <textarea
                rows={7}
                value={villa.description}
                onChange={(e) => setVilla({ ...villa, description: e.target.value })}
                placeholder="Une villa de quatre chambres à cinq minutes de la plage, avec piscine et cuisine équipée…"
              />
            </label>
          )}

          {/* ── Ce qui manque encore, si la publication a été refusée ── */}
          {manques.length > 0 && (
            <div className="publication-manques" role="alert">
              <p>Il manque encore ceci :</p>
              <ul>
                {manques.map((m) => (
                  <li key={`${m.etape}-${m.message}`}>
                    {m.message}{' '}
                    <button
                      type="button"
                      onClick={() => {
                        const i = ETAPES.findIndex((e) => e.cle === m.etape)
                        if (i >= 0) { setIndex(i); setManques([]) }
                      }}
                    >
                      Reprendre
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="publication-actions">
            {index > 0 && (
              <Button variante="discret" onClick={() => setIndex(index - 1)} type="button" disabled={occupe}>
                <ArrowLeft size={15} aria-hidden="true" /> Précédent
              </Button>
            )}

            <span className="publication-espace" />

            {/* Passer n'existe pas sur la première étape : sans nom ni ville,
                il n'y a rien à enregistrer, donc rien à reprendre plus tard. */}
            {!etape.obligatoire && index < ETAPES.length - 1 && (
              <Button variante="discret" onClick={passer} type="button" disabled={occupe}>
                Passer
              </Button>
            )}

            {index < ETAPES.length - 1 ? (
              <Button variante="primaire" onClick={suivant} type="button" disabled={occupe}>
                {occupe ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
                Continuer <ArrowRight size={15} aria-hidden="true" />
              </Button>
            ) : (
              <Button variante="primaire" onClick={publier} type="button" disabled={occupe}>
                {occupe ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
                Envoyer à la validation
              </Button>
            )}
          </div>
        </section>

        {/* ── L'aperçu, permanent ─────────────────────────────────
            Il voit ce qu'il fabrique, et les trous sont nommés plutôt
            qu'inventés : un aperçu qui remplit les vides par du texte
            d'exemple laisse publier une annonce qu'on n'a pas relue. */}
        <aside className="publication-apercu" aria-label="Aperçu de votre annonce">
          <p className="publication-apercu-titre">Ce que verront les clients</p>

          <div className="apercu-carte">
            <div className="apercu-photo">
              {photos[0]
                ? <img src={photos[0].url} alt="" loading="lazy" />
                : <span>Aucune photo</span>}
            </div>

            <div className="apercu-corps">
              <p className="apercu-nom">{villa.nom || <em>Nom à renseigner</em>}</p>
              <p className="apercu-ville">{villa.ville || <em>Ville à renseigner</em>}</p>
              <p className="apercu-prix">
                {tarif.prix
                  ? <><strong>{fcfa(Number(tarif.prix))}</strong> · {LIBELLES_TARIF[tarif.type_tarif].toLowerCase()}</>
                  : <em>Tarif à fixer</em>}
              </p>
            </div>
          </div>

          <p className="publication-apercu-note">
            Votre annonce reste un brouillon tant que vous ne l'envoyez pas.
            Personne ne la voit, pas même nos modérateurs.
          </p>
        </aside>
      </div>
    </div>
  )
}
