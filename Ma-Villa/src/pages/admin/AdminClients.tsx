import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Contact, Download, Mail, Search, UserRound } from 'lucide-react'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { useRequete } from '../../lib/useRequete'
import { messageErreur } from '../../lib/erreurs'
import { dateCourte, depuis, fcfa } from '../../lib/format'
import { lienCourriel, lienWhatsApp } from '../../lib/contact'
import { versPage, type Page } from '../../lib/page'
import { enregistrerFichier } from '../../lib/telecharger'
import Button, { ButtonLink } from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import BoutonWhatsApp from '../../components/BoutonWhatsApp'
import Pagination from '../../components/console/Pagination'
import ListeConsole from '../../components/console/ListeConsole'

interface Evenement {
  type: 'compte' | 'devis' | 'demande' | 'service' | 'reservation' | 'commande'
  date: string | null
  libelle: string
  detail: string | null
  montant: number | null
  statut: string | null
  lien: string | null
}

interface Client {
  cle: string
  nom: string
  noms: string[]
  telephones: string[]
  emails: string[]
  compte: { id: number; nom: string } | null
  premier_contact: string | null
  dernier_contact: string | null
  langue: 'fr' | 'en' | null
  nombres: { devis: number; demandes: number; services: number; reservations: number; commandes: number }
  montant_devis: number
  hebergements: string[]
  evenements: Evenement[]
}

interface Reponse extends Page<Client> {
  resume?: { clients: number; sans_compte: number; joignables: number; ont_reserve: number }
}

const FILTRES = [
  { valeur: '', label: 'Tous' },
  { valeur: 'sans_compte', label: 'Sans compte' },
  { valeur: 'avec_compte', label: 'Avec compte' },
  { valeur: 'devis_seul', label: 'Devis sans réservation' },
  { valeur: 'ont_reserve', label: 'Ont réservé' },
]

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

/** « 2 devis · 1 demande » : seulement ce qui existe. */
function activite(c: Client): string {
  const { devis, demandes, services, reservations, commandes } = c.nombres
  return [
    devis ? `${devis} devis` : null,
    demandes ? (demandes > 1 ? `${demandes} demandes particulières` : '1 demande particulière') : null,
    services ? `${pluriel(services, 'demande')} de service` : null,
    reservations ? pluriel(reservations, 'réservation') : null,
    commandes ? pluriel(commandes, 'commande') : null,
  ].filter(Boolean).join(' · ') || 'Compte sans activité'
}

/**
 * Le fichier clients : une ligne par personne, d'où qu'elle vienne.
 *
 * Depuis le 4 novembre 2026, un client qui nous joint depuis une fiche passe par
 * un devis : c'est ici qu'on le retrouve, quand il rappelle trois semaines plus
 * tard, ou pour prévenir ceux qui avaient demandé une date. Le serveur regroupe
 * les écritures d'un même numéro (voir `FichierClients`).
 *
 * L'export contient des données personnelles : chaque téléchargement est noté au
 * journal, et le bouton le dit.
 */
export default function AdminClients() {
  const toast = useToast()
  const [filtre, setFiltre] = useState('')
  const [recherche, setRecherche] = useState('')
  const [terme, setTerme] = useState('')
  const [page, setPage] = useState(1)
  const [exportEnCours, setExportEnCours] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => { setTerme(recherche.trim()); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [recherche])

  const criteres = `${filtre ? `filtre=${filtre}&` : ''}${terme ? `recherche=${encodeURIComponent(terme)}&` : ''}`
  const requete = `${criteres}page=${page}`

  const { donnees, chargement, erreur, reessayer } = useRequete<Reponse>(
    async (signal) => (await api.get(`/admin/clients?${requete}`, { signal })).data,
    `admin-clients-${requete}`,
    { messageErreurParDefaut: 'Impossible de charger le fichier clients.' }
  )
  const resultat = versPage<Client>(donnees)
  const clients = resultat?.data ?? []
  const resume = donnees?.resume

  const exporter = async () => {
    setExportEnCours(true)
    try {
      const { data } = await api.get(`/admin/clients/export?${criteres}`, { responseType: 'blob' })
      enregistrerFichier(data as Blob, `PasseTemps-clients-${new Date().toISOString().slice(0, 10)}.csv`)
      toast.succes('Fichier préparé. Le téléchargement est noté au journal.')
    } catch (err) {
      toast.erreur(messageErreur(err, 'Le fichier n’a pas pu être préparé.'))
    } finally {
      setExportEnCours(false)
    }
  }

  return (
    <div>
      <ListeConsole
        titre="Clients"
        sousTitre={resume
          ? `${pluriel(resume.clients, 'personne')} · ${resume.sans_compte} sans compte · ${resume.joignables} joignable${resume.joignables > 1 ? 's' : ''} · ${resume.ont_reserve} ${resume.ont_reserve > 1 ? 'ont' : 'a'} réservé`
          : 'Tous ceux qui nous ont laissé leurs coordonnées, regroupés par numéro et par adresse.'}
        chargement={chargement}
        erreur={erreur}
        reessayer={reessayer}
        vide={clients.length === 0}
        videIcone={Contact}
        squelette={5}
        videTexte={terme
          ? <>Aucun client ne correspond à <strong>{terme}</strong>.</>
          : 'Aucun client pour ce filtre.'}
        outils={<div className="console-filtres">
          <div className="console-onglets" role="tablist">
            {FILTRES.map((f) => (
              <button
                key={f.valeur || 'tous'}
                role="tab"
                aria-selected={filtre === f.valeur}
                className={`console-onglet${filtre === f.valeur ? ' est-actif' : ''}`}
                onClick={() => { setFiltre(f.valeur); setPage(1) }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="console-recherche">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              className="champ-controle"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Nom, téléphone, e-mail, hébergement…"
              aria-label="Rechercher un client"
            />
          </div>

          <Button
            variante="secondaire"
            taille="sm"
            chargement={exportEnCours}
            iconeAvant={<Download size={15} aria-hidden="true" />}
            onClick={exporter}
            title="Fichier CSV, pour Excel. Le téléchargement est noté au journal."
          >
            Exporter
          </Button>
        </div>}
      >
        <div className="liste-console">
          {clients.map((c) => {
            const telephone = c.telephones[0]
            const email = c.emails[0]
            const bonjour = c.langue === 'en' ? `Hello ${c.nom}, ` : `Bonjour ${c.nom}, `
            return (
              <article key={c.cle} className="panneau commande-admin">
                <div className="commande-admin-haut">
                  <div className="commande-admin-titre">
                    <p className="tableau-fort">{c.nom}</p>
                    <p className="tableau-second">
                      {c.dernier_contact ? `Dernier contact : ${depuis(c.dernier_contact)}` : 'Aucune date'}
                      {c.premier_contact && c.premier_contact !== c.dernier_contact ? ` · depuis le ${dateCourte(c.premier_contact)}` : ''}
                      {c.langue === 'en' ? ' · en anglais' : ''}
                    </p>
                  </div>
                  <div className="commande-ligne-droite">
                    <Badge ton={c.compte ? 'success' : 'neutre'}>{c.compte ? 'Compte' : 'Sans compte'}</Badge>
                  </div>
                </div>

                <dl className="commande-admin-faits">
                  <div><dt>Téléphone</dt><dd>{c.telephones.join(' · ') || '—'}</dd></div>
                  <div><dt>E-mail</dt><dd className="clients-courriel">{c.emails.join(' · ') || '—'}</dd></div>
                  <div><dt>Activité</dt><dd>{activite(c)}</dd></div>
                  {c.montant_devis > 0 && <div><dt>Devis</dt><dd>{fcfa(c.montant_devis)}</dd></div>}
                  {c.hebergements.length > 0 && <div><dt>Hébergements</dt><dd>{c.hebergements.join(', ')}</dd></div>}
                  {c.noms.length > 1 && <div><dt>Aussi écrit</dt><dd>{c.noms.filter((n) => n !== c.nom).join(', ')}</dd></div>}
                </dl>

                <details className="clients-historique">
                  <summary>Historique ({c.evenements.length})</summary>
                  <ul className="fiche-lignes">
                    {c.evenements.map((e, i) => (
                      <li key={`${e.type}-${i}`}>
                        <span>
                          {e.lien ? <Link to={e.lien} className="underline underline-offset-2">{e.libelle}</Link> : e.libelle}
                          <span className="tableau-second"> · {e.date ? dateCourte(e.date) : '—'}{e.detail ? ` · ${e.detail}` : ''}</span>
                        </span>
                        <span className="tableau-second clients-droite">
                          {[e.statut, e.montant ? fcfa(e.montant) : null].filter(Boolean).join(' · ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>

                <div className="reservation-actions">
                  {telephone && <BoutonWhatsApp href={lienWhatsApp(telephone, bonjour)} taille="sm">Écrire</BoutonWhatsApp>}
                  {email && (
                    <a href={lienCourriel(email, 'PasseTemps')} className="btn btn-secondaire btn-sm">
                      <Mail size={15} aria-hidden="true" />
                      <span>E-mail</span>
                    </a>
                  )}
                  {c.compte && (
                    <ButtonLink to={`/admin/utilisateurs/${c.compte.id}`} taille="sm" iconeAvant={<UserRound size={15} aria-hidden="true" />}>
                      Fiche du compte
                    </ButtonLink>
                  )}
                </div>
              </article>
            )
          })}
        </div>
        <Pagination page={resultat} onChange={setPage} unite="client" />
      </ListeConsole>
    </div>
  )
}
