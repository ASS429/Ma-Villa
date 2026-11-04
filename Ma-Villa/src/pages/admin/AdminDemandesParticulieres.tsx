import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Mail, PartyPopper } from 'lucide-react'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { useRequete } from '../../lib/useRequete'
import { messageErreur } from '../../lib/erreurs'
import { depuis } from '../../lib/format'
import { lienCourriel, lienWhatsApp } from '../../lib/contact'
import { relireAttentes } from '../../lib/attentes'
import { versPage, type Page } from '../../lib/page'
import { budgetLisible, datesLisibles, type DemandeParticuliere, type StatutParticuliere } from '../../lib/particuliere'
import { TEXTES_HEBERGEMENT } from '../../i18n/hebergement'
import Button, { ButtonLink } from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import BoutonWhatsApp from '../../components/BoutonWhatsApp'
import Pagination from '../../components/console/Pagination'
import ListeConsole from '../../components/console/ListeConsole'

const FILTRES: { valeur: string; label: string }[] = [
  { valeur: 'nouvelle', label: 'À traiter' },
  { valeur: 'traitee', label: 'Traitées' },
  { valeur: 'abandonnee', label: 'Abandonnées' },
  { valeur: '', label: 'Toutes' },
]

const LIBELLES: Record<StatutParticuliere, string> = { nouvelle: 'Nouvelle', traitee: 'Traitée', abandonnee: 'Abandonnée' }
const TON = { nouvelle: 'warning', traitee: 'success', abandonnee: 'neutre' } as const
const T = TEXTES_HEBERGEMENT.fr.particuliere

/**
 * Les demandes particulières : événements, séminaires, groupes, longs séjours.
 *
 * La réponse se fait sur WhatsApp ou par e-mail, et souvent par un devis :
 * « Établir un devis » ouvre l'éditeur prérempli. « Traitée » la sort de « Ce
 * qui attend », et c'est tout ce que le geste fait.
 */
export default function AdminDemandesParticulieres() {
  const toast = useToast()
  const [filtre, setFiltre] = useState('nouvelle')
  const [page, setPage] = useState(1)
  const [enCours, setEnCours] = useState<number | null>(null)

  const query = `${filtre ? `statut=${filtre}&` : ''}page=${page}`
  const { donnees, chargement, erreur, reessayer } = useRequete<Page<DemandeParticuliere> | DemandeParticuliere[]>(
    async (signal) => (await api.get(`/admin/demandes-particulieres?${query}`, { signal })).data,
    `admin-particulieres-${query}`,
    { messageErreurParDefaut: 'Impossible de charger les demandes particulières.' }
  )
  const resultat = versPage<DemandeParticuliere>(donnees)
  const liste = resultat?.data ?? []

  const changer = async (d: DemandeParticuliere, statut: StatutParticuliere) => {
    setEnCours(d.id)
    try {
      await api.patch(`/admin/demandes-particulieres/${d.id}`, { statut })
      toast.succes(statut === 'nouvelle' ? `${d.reference} remise à traiter.` : `${d.reference} ${LIBELLES[statut].toLowerCase()}.`)
      reessayer()
      relireAttentes()
    } catch (err) {
      toast.erreur(messageErreur(err, 'La demande n’a pas pu être mise à jour.'))
    } finally {
      setEnCours(null)
    }
  }

  return (
    <div>
      <ListeConsole
        titre="Demandes particulières"
        sousTitre={<>
          Événements, séminaires, groupes et longs séjours demandés depuis une fiche. Répondez sur
          WhatsApp ou par e-mail, établissez un devis si besoin, puis marquez la demande traitée.
        </>}
        chargement={chargement}
        erreur={erreur}
        reessayer={reessayer}
        vide={liste.length === 0}
        videIcone={PartyPopper}
        videTexte={filtre === 'nouvelle' ? 'Aucune demande en attente.' : 'Aucune demande dans cet état.'}
        outils={<div className="console-filtres">
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
        </div>}
      >
        <div className="liste-console">
          {liste.map((d) => {
            const reponse = `Bonjour ${d.nom}, merci pour votre demande ${d.reference}${d.villa ? ` pour ${d.villa.nom}` : ''}. `
            return (
              <article key={d.id} className="panneau commande-admin">
                <div className="commande-admin-haut">
                  <div className="commande-admin-titre">
                    <p className="tableau-fort">
                      {d.libelle_type}
                      {d.villa && <> · <Link to={`/hebergements/${d.villa.id}/`} className="underline underline-offset-2">{d.villa.nom}</Link></>}
                    </p>
                    <p className="tableau-second">
                      {d.reference} · {depuis(d.created_at)} · {d.nom}
                      {d.langue === 'en' ? ' · en anglais' : ''}
                    </p>
                  </div>
                  <div className="commande-ligne-droite">
                    <Badge ton={TON[d.statut]}>{LIBELLES[d.statut]}</Badge>
                  </div>
                </div>

                <dl className="commande-admin-faits">
                  <div><dt>Quand</dt><dd>{datesLisibles(d, 'fr', T.aConfirmerCourt) ?? '—'}</dd></div>
                  <div>
                    <dt>Personnes</dt>
                    <dd>
                      {d.personnes_sejour ? `${d.personnes_sejour} sur place` : '—'}
                      {d.invites ? ` · ${d.invites} invités en journée` : ''}
                    </dd>
                  </div>
                  {!!d.besoins?.length && (
                    <div><dt>Besoins</dt><dd>{d.besoins.map((b) => T.listeBesoins[b]).join(', ')}</dd></div>
                  )}
                  {d.budget ? <div><dt>Budget</dt><dd>{budgetLisible(d.budget)}</dd></div> : null}
                  <div><dt>Contact</dt><dd>{[d.telephone, d.email].filter(Boolean).join(' · ')}</dd></div>
                </dl>

                <p className="particuliere-message">{d.message}</p>

                <div className="reservation-actions">
                  {d.telephone && <BoutonWhatsApp href={lienWhatsApp(d.telephone, reponse)} taille="sm">Répondre</BoutonWhatsApp>}
                  {d.email && (
                    <a href={lienCourriel(d.email, `Votre demande ${d.reference} — PasseTemps`)} className="btn btn-secondaire btn-sm">
                      <Mail size={15} aria-hidden="true" />
                      <span>E-mail</span>
                    </a>
                  )}
                  <ButtonLink to={`/admin/devis/nouveau?demande=${d.id}`} taille="sm" iconeAvant={<FileText size={15} aria-hidden="true" />}>
                    Établir un devis
                  </ButtonLink>
                  {d.statut === 'nouvelle' ? (
                    <>
                      <Button variante="discret" taille="sm" chargement={enCours === d.id} onClick={() => changer(d, 'traitee')}>Traitée</Button>
                      <Button variante="discret" taille="sm" disabled={enCours === d.id} onClick={() => changer(d, 'abandonnee')}>Abandonnée</Button>
                    </>
                  ) : (
                    <Button variante="discret" taille="sm" chargement={enCours === d.id} onClick={() => changer(d, 'nouvelle')}>Remettre à traiter</Button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
        <Pagination page={resultat} onChange={setPage} unite="demande" />
      </ListeConsole>
    </div>
  )
}
