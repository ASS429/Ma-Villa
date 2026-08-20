import { useState } from 'react'
import { Palette, Plus, X, Trash2, ImageOff } from 'lucide-react'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { useRequete } from '../../lib/useRequete'
import { messageErreur } from '../../lib/erreurs'
import { fcfa } from '../../lib/format'
import { versPage, type Page } from '../../lib/page'
import { LIBELLES_STATUT_OEUVRE, type Oeuvre, type StatutOeuvre } from '../../types'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Champ, ChampSelection, ChampZoneTexte } from '../../components/ui/Champ'
import Pagination from '../../components/console/Pagination'
import TeleverseurPhotos from '../../components/console/TeleverseurPhotos'

const TON: Record<StatutOeuvre, 'success' | 'warning' | 'neutre'> = {
  brouillon: 'warning',
  publiee: 'success',
  vendue: 'neutre',
}

const FILTRES = [
  { valeur: '', label: 'Toutes' },
  { valeur: 'publiee', label: 'En vente' },
  { valeur: 'brouillon', label: 'Brouillons' },
  { valeur: 'vendue', label: 'Vendues' },
]

/** Le formulaire vide, à l'ouverture. */
const VIERGE = {
  titre: '', artiste: '', prix: '', description: '',
  technique: '', dimensions: '', annee: '', statut: 'brouillon' as StatutOeuvre,
  vedette: false,
}

export default function AdminOeuvres() {
  const toast = useToast()
  const [filtre, setFiltre] = useState('')
  const [page, setPage] = useState(1)
  const [edition, setEdition] = useState<Oeuvre | null>(null)
  const [creation, setCreation] = useState(false)
  const [formulaire, setFormulaire] = useState({ ...VIERGE })
  const [envoi, setEnvoi] = useState(false)

  const query = `${filtre ? `statut=${filtre}&` : ''}page=${page}`

  const { donnees, chargement, erreur, reessayer } = useRequete<Page<Oeuvre> | Oeuvre[]>(
    async (signal) => (await api.get(`/admin/oeuvres?${query}`, { signal })).data,
    `admin-oeuvres-${query}`,
    { messageErreurParDefaut: 'Impossible de charger les œuvres.' }
  )

  const resultat = versPage<Oeuvre>(donnees)
  const liste = resultat?.data ?? []
  const ouvert = creation || edition !== null

  const ouvrirCreation = () => {
    setFormulaire({ ...VIERGE })
    setEdition(null)
    setCreation(true)
  }

  const ouvrirEdition = (oeuvre: Oeuvre) => {
    setFormulaire({
      titre: oeuvre.titre,
      artiste: oeuvre.artiste,
      prix: String(oeuvre.prix),
      description: oeuvre.description ?? '',
      technique: oeuvre.technique ?? '',
      dimensions: oeuvre.dimensions ?? '',
      annee: oeuvre.annee ? String(oeuvre.annee) : '',
      statut: oeuvre.statut,
      vedette: oeuvre.vedette,
    })
    setCreation(false)
    setEdition(oeuvre)
  }

  const fermer = () => { setCreation(false); setEdition(null) }

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (envoi) return

    setEnvoi(true)
    try {
      const charge = {
        titre: formulaire.titre.trim(),
        artiste: formulaire.artiste.trim(),
        prix: Number(formulaire.prix),
        description: formulaire.description.trim() || null,
        technique: formulaire.technique.trim() || null,
        dimensions: formulaire.dimensions.trim() || null,
        annee: formulaire.annee ? Number(formulaire.annee) : null,
        statut: formulaire.statut,
        vedette: formulaire.vedette,
      }

      if (edition) {
        await api.patch(`/admin/oeuvres/${edition.id}`, charge)
        toast.succes('Œuvre mise à jour.')
      } else {
        const { data } = await api.post('/admin/oeuvres', charge)
        toast.succes('Œuvre créée. Ajoutez-lui des photos.')
        // On enchaîne sur l'édition : une œuvre sans photo ne se vend pas, et
        // refermer ici obligerait à la rouvrir aussitôt.
        setCreation(false)
        setEdition(data)
        reessayer()
        return
      }

      fermer()
      reessayer()
    } catch (err) {
      toast.erreur(messageErreur(err, "L'œuvre n'a pas pu être enregistrée."))
    } finally {
      setEnvoi(false)
    }
  }

  const supprimer = async (oeuvre: Oeuvre) => {
    try {
      await api.delete(`/admin/oeuvres/${oeuvre.id}`)
      toast.succes('Œuvre supprimée.')
      fermer()
      reessayer()
    } catch (err) {
      toast.erreur(messageErreur(err, "L'œuvre n'a pas pu être supprimée."))
    }
  }

  return (
    <div>
      <h1 className="console-titre">Œuvres</h1>
      <p className="console-sous-titre">
        Ma Villa est le seul vendeur : une œuvre publiée part en vitrine sans
        validation. Une pièce se vend une fois — commander la retire aussitôt.
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

        <Button variante="primaire" taille="sm" onClick={ouvrirCreation} iconeAvant={<Plus size={15} />}>
          Nouvelle œuvre
        </Button>
      </div>

      {erreur && !chargement && (
        <div className="console-erreur" role="alert">
          {erreur}
          <Button variante="secondaire" taille="sm" onClick={reessayer}>Réessayer</Button>
        </div>
      )}

      {chargement ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2].map((n) => <div key={n} className="skeleton" style={{ height: 64, borderRadius: 10 }} />)}
        </div>
      ) : liste.length === 0 ? (
        <div className="console-vide">
          <span className="console-vide-icone"><Palette size={22} /></span>
          <p>Aucune œuvre pour l'instant. Créez la première : elle restera en brouillon tant que vous ne l'aurez pas publiée.</p>
        </div>
      ) : (
        <>
          <div className="admin-oeuvres">
            {liste.map((o) => (
              <button key={o.id} className="admin-oeuvre" onClick={() => ouvrirEdition(o)}>
                {o.photos?.[0] ? (
                  <img src={o.photos[0].url} alt="" loading="lazy" />
                ) : (
                  <span className="carte-oeuvre-vide" aria-hidden="true"><ImageOff size={18} /></span>
                )}
                <span className="admin-oeuvre-texte">
                  <span className="tableau-fort">{o.titre}</span>
                  <span className="tableau-second">{o.artiste}</span>
                  <span className="commande-montant">{fcfa(o.prix)}</span>
                </span>
                <Badge ton={TON[o.statut]}>{LIBELLES_STATUT_OEUVRE[o.statut]}</Badge>
              </button>
            ))}
          </div>

          <Pagination page={resultat} onChange={setPage} unite="œuvres" />
        </>
      )}

      {ouvert && (
        <>
          <div className="console-voile" onClick={() => !envoi && fermer()} aria-hidden="true" />
          <div className="modale modale-large" role="dialog" aria-modal="true" aria-labelledby="titre-oeuvre">
            <div className="modale-entete">
              <h2 id="titre-oeuvre" className="panneau-titre" style={{ margin: 0 }}>
                {edition ? edition.titre : 'Nouvelle œuvre'}
              </h2>
              <Button variante="discret" taille="sm" onClick={fermer} iconeAvant={<X size={18} />} aria-label="Fermer" />
            </div>

            <form onSubmit={enregistrer} className="modale-formulaire">
              <Champ
                label="Titre"
                value={formulaire.titre}
                onChange={(e) => setFormulaire({ ...formulaire, titre: e.target.value })}
                maxLength={160}
                required
              />
              <Champ
                label="Artiste"
                value={formulaire.artiste}
                onChange={(e) => setFormulaire({ ...formulaire, artiste: e.target.value })}
                maxLength={120}
                required
              />
              <Champ
                label="Prix en FCFA"
                type="number"
                min={1}
                value={formulaire.prix}
                onChange={(e) => setFormulaire({ ...formulaire, prix: e.target.value })}
                required
              />
              <Champ
                label="Technique"
                aide="Acrylique sur toile, bogolan, photographie…"
                value={formulaire.technique}
                onChange={(e) => setFormulaire({ ...formulaire, technique: e.target.value })}
                maxLength={120}
              />
              <Champ
                label="Dimensions"
                aide="80 × 120 cm"
                value={formulaire.dimensions}
                onChange={(e) => setFormulaire({ ...formulaire, dimensions: e.target.value })}
                maxLength={80}
              />
              <Champ
                label="Année"
                type="number"
                min={1800}
                value={formulaire.annee}
                onChange={(e) => setFormulaire({ ...formulaire, annee: e.target.value })}
              />
              <ChampZoneTexte
                label="Description"
                rows={4}
                value={formulaire.description}
                onChange={(e) => setFormulaire({ ...formulaire, description: e.target.value })}
                maxLength={4000}
              />
              <ChampSelection
                label="Statut"
                aide={
                  edition?.statut === 'vendue'
                    ? 'Vendue : pour la remettre en vente, annulez la commande concernée.'
                    : 'Un brouillon n\'apparaît nulle part.'
                }
                value={formulaire.statut}
                onChange={(e) => setFormulaire({ ...formulaire, statut: e.target.value as StatutOeuvre })}
              >
                <option value="brouillon">Brouillon</option>
                <option value="publiee">En vente</option>
                {edition?.statut === 'vendue' && <option value="vendue">Vendue</option>}
              </ChampSelection>

              <label className={`choix${formulaire.vedette ? ' est-actif' : ''}`}>
                <input
                  type="checkbox"
                  checked={formulaire.vedette}
                  onChange={(e) => setFormulaire({ ...formulaire, vedette: e.target.checked })}
                />
                <span>
                  <span className="choix-titre">Coup de cœur</span>
                  <span className="choix-aide">Remonte l'œuvre en tête de la vitrine.</span>
                </span>
              </label>

              <div className="modale-actions">
                {edition && (
                  <Button
                    variante="discret"
                    onClick={() => supprimer(edition)}
                    iconeAvant={<Trash2 size={15} />}
                    disabled={envoi}
                  >
                    Supprimer
                  </Button>
                )}
                <Button variante="secondaire" onClick={fermer} disabled={envoi}>Fermer</Button>
                <Button type="submit" variante="primaire" chargement={envoi}>
                  {edition ? 'Enregistrer' : 'Créer'}
                </Button>
              </div>
            </form>

            {/* Les photos ne s'attachent qu'à une œuvre existante : il faut un
                identifiant pour les téléverser. */}
            {edition && (
              <div className="modale-photos">
                <h3 className="panneau-titre">Photos</h3>
                <TeleverseurPhotos
                  photos={edition.photos ?? []}
                  cheminAjout={`/admin/oeuvres/${edition.id}/photos`}
                  cheminSuppression={(photoId) => `/admin/oeuvres/${edition.id}/photos/${photoId}`}
                  onChange={reessayer}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
