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
import { useLangue } from '../../i18n/langue'
import { TEXTES_BOUTIQUE } from '../../i18n/boutique'

const TRIS = [
  { valeur: 'recent', cle: 'recent' },
  { valeur: 'prix_asc', cle: 'prixAsc' },
  { valeur: 'prix_desc', cle: 'prixDesc' },
] as const

export default function Boutique() {
  const { boutique, chargee, paiement } = useConfig()
  const { langue, lien } = useLangue()
  const t = TEXTES_BOUTIQUE[langue].vitrine
  const categoriesEn = TEXTES_BOUTIQUE[langue].categories
  // N'annoncer que ce qui est ouvert : le paiement en ligne est fermé depuis le
  // 14 septembre 2026, et le promettre ici, c'est le voir manquer au moment de
  // commander.
  const reglement = paiement.actif
    ? t.reglementEnLigne(boutique.livraison)
    : boutique.livraison ? t.reglementLivraison : t.reglementBientot
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
    { messageErreurParDefaut: t.chargementImpossible }
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
  if (!boutique.actif) return <Navigate to={lien('/')} replace />

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
      {/* Mêmes mots que le pré-rendu — c'est la version rendue que Google
          retient, et deux titres pour une page finissent par diverger. La
          boutique vend des vêtements et de la vannerie, pas des tableaux. */}
      <Seo
        titre={t.seoTitre}
        description={t.seoDescription}
        chemin={lien('/boutique/')}
      />
      <Navbar />

      <div className="boutique">
        <header className="boutique-entete">
          <p className="boutique-surtitre">
            <Palette size={15} aria-hidden="true" />
            {t.surtitre}
          </p>
          <h1 className="boutique-titre">{t.titre}</h1>
          <p className="boutique-chapeau">
            {t.chapeau(reglement)}
          </p>
        </header>

        {(categories?.length ?? 0) > 1 && (
          <nav className="boutique-categories" aria-label={t.categories}>
            <button
              type="button"
              className={`categorie-pastille${categorie === '' ? ' est-active' : ''}`}
              aria-pressed={categorie === ''}
              onClick={() => changerCategorie('')}
            >
              {t.tout}
            </button>
            {categories?.map((c) => (
              <button
                key={c.cle}
                type="button"
                className={`categorie-pastille${categorie === c.cle ? ' est-active' : ''}`}
                aria-pressed={categorie === c.cle}
                onClick={() => changerCategorie(c.cle)}
              >
                {categoriesEn[c.cle] ?? c.pluriel}
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
              placeholder={t.placeholder}
              aria-label={t.rechercher}
            />
            <Button type="submit" variante="primaire" taille="sm">{t.chercher}</Button>
          </form>

          <div className="boutique-affinages">
            {(artistes?.length ?? 0) > 0 && (
              <select
                className="champ-controle"
                value={artiste}
                onChange={(e) => changerArtiste(e.target.value)}
                aria-label={t.parArtiste}
              >
                <option value="">{t.tousArtistes}</option>
                {artistes?.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            )}

            <select
              className="champ-controle"
              value={tri}
              onChange={(e) => changerTri(e.target.value)}
              aria-label={t.trier}
            >
              {TRIS.map((tri) => <option key={tri.valeur} value={tri.valeur}>{t.tris[tri.cle]}</option>)}
            </select>
          </div>
        </div>

        {erreur && !chargement && (
          <div className="console-erreur" role="alert">
            {erreur}
            <Button variante="secondaire" taille="sm" onClick={reessayer}>{t.reessayer}</Button>
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
                ? t.aucun
                : t.seRemplit}
            </p>
            {(recherche || artiste || categorie) && (
              <Button
                variante="secondaire"
                taille="sm"
                onClick={() => { setRecherche(''); setSaisie(''); setArtiste(''); setCategorie(''); setPage(1) }}
              >
                {t.toutVoir}
              </Button>
            )}
          </div>
        ) : (
          <>
            <p className="boutique-compte">
              {t.articles(resultat?.total ?? oeuvres.length)}
              {/* Le prix d'entrée vient du serveur : calculé ici, il ne voyait
                  que la page affichée et annonçait un plancher trop haut. */}
              {resultat?.prix_min ? t.aPartirDe(fcfa(resultat.prix_min)) : ''}
            </p>

            <div className="boutique-grille">
              {oeuvres.map((oeuvre) => (
                <Link key={oeuvre.id} to={lien(`/boutique/${oeuvre.id}/`)} className="boutique-lien">
                  <CarteOeuvre oeuvre={oeuvre} />
                </Link>
              ))}
            </div>

            <Pagination page={resultat} onChange={setPage} unite={t.unite} />
          </>
        )}
      </div>

      <Footer />
    </>
  )
}
