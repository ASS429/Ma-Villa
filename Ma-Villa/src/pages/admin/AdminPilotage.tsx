import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle, AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, ChevronRight, Download, FileSpreadsheet, Info, Search, TrendingDown, TrendingUp,
} from 'lucide-react'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { useRequete } from '../../lib/useRequete'
import { dateCourte, fcfa, fcfaCourt } from '../../lib/format'
import { enregistrerFichier } from '../../lib/telecharger'
import {
  evolution, feuillesDuPilotage, LIBELLES_GRAVITE, LIBELLES_GROUPE,
  type GroupeIndicateur, type Indicateur, type LigneHebergement, type LigneVille, type Manquement, type Pilotage,
} from '../../lib/pilotage'
import Button from '../../components/ui/Button'
import { Barres } from '../../components/console/Graphe'
import { CarteChaleur, Entonnoir, GrapheTemps, type LigneTemps, type SerieTemps } from '../../components/console/Graphiques'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const ilYA = (jours: number) => iso(new Date(Date.now() - jours * 864e5))

const PERIODES: { cle: string; label: string; du: () => string }[] = [
  { cle: '7', label: '7 jours', du: () => ilYA(6) },
  { cle: '30', label: '30 jours', du: () => ilYA(29) },
  { cle: '90', label: '90 jours', du: () => ilYA(89) },
  { cle: '365', label: '12 mois', du: () => ilYA(364) },
  { cle: 'annee', label: 'Cette année', du: () => `${new Date().getFullYear()}-01-01` },
]

const SERIES_DEMANDES: SerieTemps[] = [
  { cle: 'devis', nom: 'Devis en ligne', couleur: 'var(--serie-1)' },
  { cle: 'particulieres', nom: 'Demandes particulières', couleur: 'var(--serie-2)' },
  { cle: 'services', nom: 'Demandes de service', couleur: 'var(--serie-3)' },
  { cle: 'reservations', nom: 'Réservations', couleur: 'var(--serie-4)' },
]

const SERIES_ARGENT: SerieTemps[] = [
  { cle: 'devis_montant', nom: 'Montant des devis', couleur: 'var(--serie-1)' },
  { cle: 'encaisse', nom: 'Encaissé', couleur: 'var(--serie-2)' },
]

const GROUPES: GroupeIndicateur[] = ['activite', 'resultat', 'qualite', 'aujourdhui']

function valeurLisible(i: Pick<Indicateur, 'format' | 'valeur'>, court = false): string {
  if (i.valeur === null) return '—'
  switch (i.format) {
    case 'fcfa': return court ? fcfaCourt(i.valeur) : fcfa(i.valeur)
    case 'pourcent': return `${Math.round(i.valeur * 100)} %`
    // « 0,1 h » ne se lit pas : sous l'heure, on compte en minutes.
    case 'heures': return i.valeur < 1 ? `${Math.round(i.valeur * 60)} min` : `${String(i.valeur).replace('.', ',')} h`
    default: return String(i.valeur)
  }
}

/** L'écart à la période précédente : la flèche dit le sens, la couleur si c'est une bonne nouvelle. */
function Ecart({ i }: { i: Indicateur }) {
  if (i.sens === 'neutre') return null
  const e = evolution(i)

  // Rien avant : la hausse n'a pas de pourcentage, et zéro contre zéro n'apprend rien.
  if (e === null) {
    return i.valeur && i.precedent === 0
      ? <span className="chiffre-variation pilotage-ecart-neutre" title="Rien sur la période précédente">Nouveau</span>
      : null
  }
  if (e === 0) return i.valeur ? <span className="chiffre-variation pilotage-ecart-neutre">Stable</span> : null

  const monte = e > 0
  const bon = i.sens === 'haut' ? monte : !monte
  const Icone = monte ? TrendingUp : TrendingDown
  const ampleur = i.format === 'pourcent'
    ? `${Math.abs(Math.round(e * 100))} point${Math.abs(Math.round(e * 100)) > 1 ? 's' : ''}`
    : `${Math.abs(Math.round(e * 100))} %`

  return (
    <span className={`chiffre-variation ${bon ? 'est-hausse' : 'est-baisse'}`} title={`Période précédente : ${valeurLisible({ format: i.format, valeur: i.precedent })}`}>
      <Icone size={13} aria-hidden="true" />
      {monte ? '+' : '−'}{ampleur}
      <span className="sr-only"> par rapport à la période précédente</span>
    </span>
  )
}

const ICONE_GRAVITE = { haute: AlertTriangle, moyenne: AlertCircle, basse: Info }

function LigneManquement({ m }: { m: Manquement }) {
  const Icone = ICONE_GRAVITE[m.gravite]
  return (
    <li className={`pilotage-manquement est-${m.gravite}`}>
      <span className="pilotage-gravite"><Icone size={14} aria-hidden="true" />{LIBELLES_GRAVITE[m.gravite]}</span>
      <div className="pilotage-manquement-texte">
        <p className="tableau-fort">{m.titre}</p>
        <p className="pilotage-detail">{m.detail}</p>
        <p className="pilotage-conseil"><strong>À faire :</strong> {m.conseil}</p>
      </div>
      {m.lien && (
        <Link to={m.lien} className="btn btn-secondaire btn-sm pilotage-ouvrir">
          <span>Ouvrir</span>
          <ChevronRight size={15} aria-hidden="true" />
        </Link>
      )}
    </li>
  )
}

/* ── Un tableau qu'on trie, comme dans Excel ─────────────────── */

interface ColonneTri<T> {
  cle: keyof T & string
  titre: string
  nombre?: boolean
  rendu?: (ligne: T) => ReactNode
}

function TableauTri<T extends object>({ colonnes, lignes, cleLigne, triInitial }: {
  colonnes: ColonneTri<T>[]
  lignes: T[]
  cleLigne: (ligne: T) => string | number
  triInitial?: keyof T & string
}) {
  const [tri, setTri] = useState<{ cle: keyof T & string; desc: boolean } | null>(triInitial ? { cle: triInitial, desc: true } : null)

  const triees = useMemo(() => {
    if (!tri) return lignes
    const sens = tri.desc ? -1 : 1
    return [...lignes].sort((a, b) => {
      const x = a[tri.cle] as unknown
      const y = b[tri.cle] as unknown
      if (x === null || x === undefined) return 1
      if (y === null || y === undefined) return -1
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * sens
      return String(x).localeCompare(String(y), 'fr') * sens
    })
  }, [lignes, tri])

  return (
    <div className="tableau-cadre">
      <table className="tableau pilotage-tableau">
        <thead>
          <tr>
            {colonnes.map((c) => {
              const actif = tri?.cle === c.cle
              return (
                <th key={c.cle} scope="col" className={c.nombre ? 'pilotage-nombre' : undefined} aria-sort={actif ? (tri?.desc ? 'descending' : 'ascending') : 'none'}>
                  <button
                    type="button"
                    className="pilotage-tri"
                    onClick={() => setTri({ cle: c.cle, desc: actif ? !tri?.desc : Boolean(c.nombre) })}
                  >
                    {c.titre}
                    {actif && (tri?.desc ? <ArrowDown size={12} aria-hidden="true" /> : <ArrowUp size={12} aria-hidden="true" />)}
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {triees.map((l) => (
            <tr key={cleLigne(l)}>
              {colonnes.map((c) => (
                <td key={c.cle} className={c.nombre ? 'pilotage-nombre' : undefined}>
                  {c.rendu ? c.rendu(l) : String(l[c.cle] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const COLONNES_HEBERGEMENTS: ColonneTri<LigneHebergement>[] = [
  {
    cle: 'nom',
    titre: 'Hébergement',
    rendu: (h) => (
      <>
        <Link to={`/hebergements/${h.id}/`} className="tableau-fort underline underline-offset-2">{h.nom}</Link>
        <br />
        <span className="tableau-second">{h.proprietaire ?? '—'}</span>
      </>
    ),
  },
  { cle: 'ville', titre: 'Ville' },
  { cle: 'demandes', titre: 'Demandes', nombre: true },
  { cle: 'refus', titre: 'Refusés', nombre: true, rendu: (h) => (h.refus ? String(h.refus) : '—') },
  { cle: 'devis', titre: 'Devis', nombre: true },
  { cle: 'particulieres', titre: 'Particulières', nombre: true },
  { cle: 'reservations', titre: 'Résa.', nombre: true },
  { cle: 'montant_devis', titre: 'Montant des devis', nombre: true, rendu: (h) => (h.montant_devis ? fcfa(h.montant_devis) : '—') },
  { cle: 'encaisse', titre: 'Encaissé', nombre: true, rendu: (h) => (h.encaisse ? fcfa(h.encaisse) : '—') },
  { cle: 'note', titre: 'Note', nombre: true, rendu: (h) => (h.note ? String(h.note).replace('.', ',') : '—') },
  { cle: 'photos', titre: 'Photos', nombre: true },
  { cle: 'prix_min', titre: 'Dès', nombre: true, rendu: (h) => (h.prix_min ? fcfa(h.prix_min) : '—') },
  { cle: 'derniere_demande', titre: 'Dernière demande', rendu: (h) => (h.derniere_demande ? dateCourte(h.derniere_demande) : '—') },
  { cle: 'defauts', titre: 'À revoir', rendu: (h) => h.defauts.join(', ') || '—' },
]

const COLONNES_VILLES: ColonneTri<LigneVille>[] = [
  { cle: 'ville', titre: 'Ville' },
  { cle: 'annonces', titre: 'Annonces', nombre: true },
  { cle: 'demandes', titre: 'Demandes', nombre: true },
  { cle: 'refus', titre: 'Refusés', nombre: true, rendu: (v) => (v.refus ? String(v.refus) : '—') },
  { cle: 'demandes_par_annonce', titre: 'Par annonce', nombre: true, rendu: (v) => (v.demandes_par_annonce === null ? '—' : String(v.demandes_par_annonce).replace('.', ',')) },
  { cle: 'montant_devis', titre: 'Montant des devis', nombre: true, rendu: (v) => (v.montant_devis ? fcfa(v.montant_devis) : '—') },
  { cle: 'encaisse', titre: 'Encaissé', nombre: true, rendu: (v) => (v.encaisse ? fcfa(v.encaisse) : '—') },
]

const COLONNES_PERIODES: ColonneTri<LigneTemps>[] = [
  { cle: 'date', titre: 'Période', rendu: (l) => String(l.libelle) },
  { cle: 'devis', titre: 'Devis en ligne', nombre: true },
  { cle: 'particulieres', titre: 'Particulières', nombre: true },
  { cle: 'services', titre: 'Services', nombre: true },
  { cle: 'reservations', titre: 'Réservations', nombre: true },
  { cle: 'comptes', titre: 'Comptes', nombre: true },
  { cle: 'refus', titre: 'Refusés', nombre: true },
  { cle: 'devis_montant', titre: 'Montant des devis', nombre: true, rendu: (l) => (Number(l.devis_montant) ? fcfa(Number(l.devis_montant)) : '—') },
  { cle: 'encaisse', titre: 'Encaissé', nombre: true, rendu: (l) => (Number(l.encaisse) ? fcfa(Number(l.encaisse)) : '—') },
]

/* ── L'écran ─────────────────────────────────────────────────── */

/**
 * Le pilotage : est-ce que ça marche, et où agir ?
 *
 * « Ce qui attend » reste l'écran du matin. Celui-ci se lit à tête reposée : ce
 * qu'on a fait, ce qu'on en a tiré, ce qui manque et ce qu'on propose d'y faire,
 * sur une période comparée à la précédente. Tout s'exporte en Excel et en CSV.
 *
 * Les filtres gardent l'écran en place : au changement de période, les chiffres
 * précédents restent affichés, atténués, le temps que les nouveaux arrivent.
 */
export default function AdminPilotage() {
  const toast = useToast()
  const [periode, setPeriode] = useState({ cle: '30', du: ilYA(29), au: iso(new Date()) })
  const [recherche, setRecherche] = useState('')

  const requete = `du=${periode.du}&au=${periode.au}`
  const { donnees: p, chargement, erreur, reessayer } = useRequete<Pilotage>(
    async (signal) => (await api.get(`/admin/pilotage?${requete}`, { signal })).data,
    `pilotage-${requete}`,
    { messageErreurParDefaut: 'Impossible de charger le tableau de pilotage.' }
  )

  const hebergements = useMemo(() => {
    const t = recherche.trim().toLowerCase()
    if (!p) return []
    if (!t) return p.hebergements
    return p.hebergements.filter((h) => [h.nom, h.ville, h.proprietaire, h.quartier].some((x) => x?.toLowerCase().includes(t)))
  }, [p, recherche])

  const exporter = async (type: 'xlsx' | 'csv') => {
    if (!p) return
    try {
      // Chargé au moment d'exporter : l'écran n'en a pas besoin pour s'afficher.
      const { versCsv, versXlsx } = await import('../../lib/tableur')
      const feuilles = feuillesDuPilotage(p)
      const nom = `PasseTemps-pilotage-${p.periode.du}-au-${p.periode.au}.${type}`
      enregistrerFichier(type === 'xlsx' ? versXlsx(feuilles) : versCsv(feuilles), nom)
    } catch {
      toast.erreur('Le fichier n’a pas pu être préparé.')
    }
  }

  const compteManquements = p?.manquements.length ?? 0
  const urgents = p?.manquements.filter((m) => m.gravite === 'haute').length ?? 0

  return (
    <div>
      <h1 className="console-titre">Pilotage</h1>
      <p className="console-sous-titre">
        {p
          ? `Du ${dateCourte(p.periode.du)} au ${dateCourte(p.periode.au)}, comparé aux ${p.periode.jours} jours précédents. Les visites du site ne sont pas mesurées.`
          : 'Ce que nous faisons, ce que nous réalisons, et où agir.'}
      </p>

      <div className="console-filtres pilotage-filtres">
        <div className="console-onglets" role="tablist" aria-label="Période">
          {PERIODES.map((f) => (
            <button
              key={f.cle}
              role="tab"
              aria-selected={periode.cle === f.cle}
              className={`console-onglet${periode.cle === f.cle ? ' est-actif' : ''}`}
              onClick={() => setPeriode({ cle: f.cle, du: f.du(), au: iso(new Date()) })}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="pilotage-dates">
          <label>
            <span>Du</span>
            <input
              type="date"
              className="champ-controle"
              value={periode.du}
              max={periode.au}
              onChange={(e) => e.target.value && setPeriode((x) => ({ ...x, cle: '', du: e.target.value }))}
            />
          </label>
          <label>
            <span>au</span>
            <input
              type="date"
              className="champ-controle"
              value={periode.au}
              min={periode.du}
              max={iso(new Date())}
              onChange={(e) => e.target.value && setPeriode((x) => ({ ...x, cle: '', au: e.target.value }))}
            />
          </label>
        </div>
        <div className="pilotage-exports">
          <Button variante="secondaire" taille="sm" disabled={!p} iconeAvant={<FileSpreadsheet size={15} aria-hidden="true" />} onClick={() => exporter('xlsx')}>
            Excel
          </Button>
          <Button variante="secondaire" taille="sm" disabled={!p} iconeAvant={<Download size={15} aria-hidden="true" />} onClick={() => exporter('csv')}>
            CSV
          </Button>
        </div>
      </div>

      {erreur && !chargement && (
        <div className="console-erreur" role="alert">
          {erreur}
          <Button variante="secondaire" taille="sm" onClick={reessayer}>Réessayer</Button>
        </div>
      )}

      {!p && chargement && (
        <div className="chiffres">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="chiffre">
              <div className="skeleton" style={{ height: 30, width: '60%', borderRadius: 8 }} />
              <div className="skeleton" style={{ height: 10, width: '80%', borderRadius: 6 }} />
            </div>
          ))}
        </div>
      )}

      {p && (
        <div className={chargement ? 'pilotage-corps est-en-cours' : 'pilotage-corps'} aria-busy={chargement}>
          {GROUPES.map((g) => (
            <section key={g} aria-labelledby={`pilotage-${g}`}>
              <h2 id={`pilotage-${g}`} className="pilotage-groupe">{LIBELLES_GROUPE[g]}</h2>
              <div className="chiffres">
                {p.indicateurs.filter((i) => i.groupe === g).map((i) => (
                  <article key={i.cle} className="chiffre pilotage-chiffre" title={i.format === 'fcfa' ? valeurLisible(i) : undefined}>
                    <p className="chiffre-valeur">
                      {valeurLisible(i, true)}
                      {i.format === 'fcfa' && i.valeur !== null && <span className="pilotage-unite"> FCFA</span>}
                    </p>
                    <p className="chiffre-libelle">{i.libelle}</p>
                    <Ecart i={i} />
                    {i.aide && <p className="chiffre-detail">{i.aide}</p>}
                  </article>
                ))}
              </div>
            </section>
          ))}

          <section className="panneau pilotage-panneau" aria-labelledby="pilotage-manquements">
            <h2 id="pilotage-manquements" className="panneau-titre">
              Nos manquements, et où améliorer
              {compteManquements > 0 && <span className="pilotage-compte">{urgents ? `${urgents} urgent${urgents > 1 ? 's' : ''} sur ${compteManquements}` : compteManquements}</span>}
            </h2>
            {compteManquements === 0 ? (
              <p className="graphe-vide">Rien à signaler sur cette période.</p>
            ) : (
              <ul className="pilotage-manquements">
                {p.manquements.map((m) => <LigneManquement key={m.titre} m={m} />)}
              </ul>
            )}
          </section>

          {p.atouts.length > 0 && (
            <section className="panneau pilotage-panneau" aria-labelledby="pilotage-atouts">
              <h2 id="pilotage-atouts" className="panneau-titre">Ce qui marche</h2>
              <ul className="pilotage-atouts">
                {p.atouts.map((a) => (
                  <li key={a}><CheckCircle2 size={16} aria-hidden="true" /><span>{a}</span></li>
                ))}
              </ul>
            </section>
          )}

          <div className="pilotage-grille">
            <section className="panneau pilotage-large">
              <h2 className="panneau-titre">Demandes reçues</h2>
              <GrapheTemps titre="Demandes reçues" forme="colonnes" lignes={p.series.lignes} series={SERIES_DEMANDES} />
            </section>
            <section className="panneau pilotage-large">
              <h2 className="panneau-titre">Montant des devis et encaissé</h2>
              <GrapheTemps titre="Montant des devis et encaissé" forme="courbes" lignes={p.series.lignes} series={SERIES_ARGENT} format={fcfa} />
            </section>
            <section className="panneau">
              <h2 className="panneau-titre">Du contact à l’argent</h2>
              <Entonnoir etapes={p.entonnoir} />
            </section>
            <section className="panneau">
              <h2 className="panneau-titre">Quand les demandes arrivent</h2>
              <CarteChaleur {...p.moments} />
            </section>
            <section className="panneau">
              <h2 className="panneau-titre">Annonces les plus demandées</h2>
              <Barres
                lignes={p.hebergements.filter((h) => h.demandes > 0).slice(0, 8).map((h) => ({ nom: h.nom, valeur: h.demandes }))}
                vide="Aucune demande sur cette période."
              />
            </section>
            {/* Trois courtes listes empilées face à la longue : côte à côte, elles
                laissaient un grand vide sous chacune. */}
            <div className="pilotage-pile">
              <section className="panneau">
                <h2 className="panneau-titre">Services demandés</h2>
                <Barres lignes={p.repartitions.prestations} vide="Aucune demande de service sur cette période." />
              </section>
              <section className="panneau">
                <h2 className="panneau-titre">Demandes particulières</h2>
                <Barres lignes={p.repartitions.types} vide="Aucune demande particulière sur cette période." />
              </section>
              <section className="panneau">
                <h2 className="panneau-titre">Langue des demandes</h2>
                <Barres lignes={p.repartitions.langues} vide="Aucune demande sur cette période." />
              </section>
              {/* `?? []` : le site peut être en ligne avant l'API qui compte les refus. */}
              <section className="panneau">
                <h2 className="panneau-titre">Devis refusés par le site</h2>
                <Barres lignes={p.repartitions.refus ?? []} vide="Aucun devis refusé sur cette période." />
              </section>
            </div>
          </div>

          <section className="panneau pilotage-panneau">
            <h2 className="panneau-titre">La demande et l’offre, ville par ville</h2>
            <p className="pilotage-detail">Beaucoup de demandes par annonce : il faut y prospecter. Beaucoup d’annonces sans demande : il faut les faire connaître.</p>
            <TableauTri colonnes={COLONNES_VILLES} lignes={p.villes} cleLigne={(v) => v.ville} triInitial="demandes" />
          </section>

          <section className="panneau pilotage-panneau">
            <div className="pilotage-entete-tableau">
              <h2 className="panneau-titre">Hébergements ({hebergements.length})</h2>
              <div className="console-recherche">
                <Search size={15} aria-hidden="true" />
                <input
                  type="search"
                  className="champ-controle"
                  placeholder="Annonce, ville, propriétaire…"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  aria-label="Filtrer les hébergements"
                />
              </div>
            </div>
            <TableauTri colonnes={COLONNES_HEBERGEMENTS} lignes={hebergements} cleLigne={(h) => h.id} />
          </section>

          <details className="panneau pilotage-panneau pilotage-details">
            <summary>Le détail, {p.series.pas === 'jour' ? 'jour par jour' : p.series.pas === 'semaine' ? 'semaine par semaine' : 'mois par mois'}</summary>
            <TableauTri colonnes={COLONNES_PERIODES} lignes={p.series.lignes} cleLigne={(l) => String(l.date)} />
          </details>
        </div>
      )}
    </div>
  )
}
