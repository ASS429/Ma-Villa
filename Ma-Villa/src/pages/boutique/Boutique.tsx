import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Search, Palette, Inbox } from 'lucide-react'
import api from '../../services/api'
import { useConfig } from '../../context/ConfigContext'
import { useRequete } from '../../lib/useRequete'
import { fcfa } from '../../lib/format'
import { versPage, type Page } from '../../lib/page'
import type { CategorieBoutique, Oeuvre } from '../../types'
import ChargementPage from '../../components/ChargementPage'
import Seo from '../../components/Seo'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'
import Button from '../../components/ui/Button'
import Pagination from '../../components/console/Pagination'
import CarteOeuvre from '../../components/boutique/CarteOeuvre'

const TRIS = [
  { valeur: 'recent', label: 'Nouveautés' },
  { valeur: 'prix_asc', label: 'Prix croissant' },
  { valeur: 'prix_desc', label: 'Prix décroissant' },
]

export default function Boutique() {
  const { boutique, chargee } = useConfig()
  const [recherche, setRecherche] = useState('')
  const [saisie, setSaisie] = useState('')
  const [categorie, setCategorie] = useState('')
  const [artiste, setArtiste] = useState('')
  const [tri, setTri] = useState('recent')
  const [page, setPage] = useState(1)

  const parametres = new URLSearchParams()
  if (categorie) parametres.set('categorie', categorie)
  if (recherche) parametres.set('q', recherche)
  if (artiste) parametres.set('artiste', artiste)
  if (tri !== 'recent') parametres.set('tri', tri)
  if (page > 1) parametres.set('page', String(page))
  const query = parametres.toString()

  const { donnees, chargement, erreur, reessayer } = useRequete<Page<Oeuvre> | Oeuvre[]>(
    async (signal) => (await api.get(`/oeuvres?${query}`, { signal })).data,
    `oeuvres-${query}`,
    { messageErreurParDefaut: 'Impossible de charger la boutique.' }
  )

  const { donnees: categories } = useRequete<CategorieBoutique[]>(
    async (signal) => (await api.get('/oeuvres/categories', { signal })).data,
    'categories-boutique',
    { messageErreurParDefaut: '' }
  )

  const { donnees: artistes } = useRequete<string[]>(
    async (signal) => (await api.get('/oeuvres/artistes', { signal })).data,
    'artistes',
    { messageErreurParDefaut: '' }
  )

  // On attend de **savoir** avant de trancher : au premier rendu la
  // configuration n'est pas encore arrivée, et rediriger à ce moment-là
  // renvoyait à l'accueil alors que la boutique était ouverte.
  if (!chargee) return <ChargementPage />
  // Fermée, elle n'existe pas : ni page, ni URL à garder en mémoire.
  if (!boutique.actif) return <Navigate to="/" replace />

  // Normalise au rendu : l'API peut répondre en page ou en tableau nu
  // selon la version déployée, et l'écran doit survivre aux deux.
  const resultat = versPage<Oeuvre>(donnees)
  const oeuvres = resultat?.data ?? []

  const rechercher = (e: React.FormEvent) => {
    e.preventDefault()
    setRecherche(saisie.trim())
    setPage(1)
  }

  const changerCategorie = (valeur: string) => { setCategorie(valeur); setPage(1) }
  const changerArtiste = (valeur: string) => { setArtiste(valeur); setPage(1) }
  const changerTri = (valeur: string) => { setTri(valeur); setPage(1) }

  return (
    <>
      <Seo
        titre="Boutique d'art"
        description="Artisanat d'art sénégalais fait main — tableaux, sculptures, bijoux, tissus. Livraison à Dakar et dans toutes les régions, paiement Wave, Orange Money ou à la livraison."
      />
      <Navbar />

      <main className="boutique">
        <header className="boutique-entete">
          <p className="boutique-surtitre">
            <Palette size={15} aria-hidden="true" />
            Boutique
          </p>
          <h1 className="boutique-titre">Artisanat d'art sénégalais</h1>
          <p className="boutique-chapeau">
            Tableaux, sculptures, bijoux, tissus — tout est fait main, et deux
            pièces ne se ressemblent jamais tout à fait. Livraison à Dakar et dans
            toutes les régions, règlement par Wave, Orange Money{boutique.livraison ? ' ou à la livraison' : ''}.
          </p>
        </header>

        {(categories?.length ?? 0) > 1 && (
          <nav className="boutique-categories" aria-label="Catégories">
            <button
              type="button"
              className={`categorie-pastille${categorie === '' ? ' est-active' : ''}`}
              aria-pressed={categorie === ''}
              onClick={() => changerCategorie('')}
            >
              Tout
            </button>
            {categories?.map((c) => (
              <button
                key={c.cle}
                type="button"
                className={`categorie-pastille${categorie === c.cle ? ' est-active' : ''}`}
                aria-pressed={categorie === c.cle}
                onClick={() => changerCategorie(c.cle)}
              >
                {c.pluriel}
                {/* Le compte évite d'ouvrir une catégorie pour découvrir
                    qu'elle tient en deux articles. */}
                <span className="categorie-compte">{c.total}</span>
              </button>
            ))}
          </nav>
        )}

        <div className="boutique-filtres">
          <form onSubmit={rechercher} className="boutique-recherche">
            <Search size={16} aria-hidden="true" />
            <input
              className="champ-controle"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              placeholder="Un titre, un artiste, une technique…"
              aria-label="Rechercher une œuvre"
            />
            <Button type="submit" variante="primaire" taille="sm">Chercher</Button>
          </form>

          <div className="boutique-affinages">
            {(artistes?.length ?? 0) > 0 && (
              <select
                className="champ-controle"
                value={artiste}
                onChange={(e) => changerArtiste(e.target.value)}
                aria-label="Filtrer par artiste"
              >
                <option value="">Tous les artistes</option>
                {artistes?.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            )}

            <select
              className="champ-controle"
              value={tri}
              onChange={(e) => changerTri(e.target.value)}
              aria-label="Trier"
            >
              {TRIS.map((t) => <option key={t.valeur} value={t.valeur}>{t.label}</option>)}
            </select>
          </div>
        </div>

        {erreur && !chargement && (
          <div className="console-erreur" role="alert">
            {erreur}
            <Button variante="secondaire" taille="sm" onClick={reessayer}>Réessayer</Button>
          </div>
        )}

        {chargement ? (
          <div className="boutique-grille">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="skeleton" style={{ aspectRatio: '3 / 4', borderRadius: 'var(--r-lg)' }} />
            ))}
          </div>
        ) : oeuvres.length === 0 ? (
          <div className="console-vide">
            <span className="console-vide-icone"><Inbox size={22} /></span>
            <p>
              {recherche || artiste || categorie
                ? 'Aucun article ne correspond à cette recherche.'
                : 'La boutique se remplit. Revenez très bientôt.'}
            </p>
            {(recherche || artiste || categorie) && (
              <Button
                variante="secondaire"
                taille="sm"
                onClick={() => { setRecherche(''); setSaisie(''); setArtiste(''); setCategorie(''); setPage(1) }}
              >
                Tout voir
              </Button>
            )}
          </div>
        ) : (
          <>
            <p className="boutique-compte">
              {resultat?.total ?? oeuvres.length} article{(resultat?.total ?? oeuvres.length) > 1 ? 's' : ''}
              {' '}· à partir de {fcfa(Math.min(...oeuvres.map((o) => o.prix)))}
            </p>

            <div className="boutique-grille">
              {oeuvres.map((oeuvre) => (
                <Link key={oeuvre.id} to={`/boutique/${oeuvre.id}`} className="boutique-lien">
                  <CarteOeuvre oeuvre={oeuvre} />
                </Link>
              ))}
            </div>

            <Pagination page={resultat} onChange={setPage} unite="articles" />
          </>
        )}
      </main>

      <Footer />
    </>
  )
}
