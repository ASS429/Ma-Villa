import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ConciergeBell, MessageCircle } from 'lucide-react'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { useRequete } from '../../lib/useRequete'
import { messageErreur } from '../../lib/erreurs'
import { dateCourte, depuis } from '../../lib/format'
import { lienWhatsApp } from '../../lib/contact'
import { relireAttentes } from '../../lib/attentes'
import { dateDuService, lienCarte } from '../../prestations/format'
import { versPage, type Page } from '../../lib/page'
import { LIBELLES_STATUT_DEMANDE, type DemandeService, type StatutDemandeService } from '../../types'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Pagination from '../../components/console/Pagination'
import ListeConsole from '../../components/console/ListeConsole'

const TON: Record<StatutDemandeService, 'success' | 'warning' | 'neutre'> = {
  nouvelle: 'warning',
  traitee: 'success',
  abandonnee: 'neutre',
}

const ORIGINE: Record<string, string> = {
  transport: 'page Transport',
  restauration: 'page Repas',
  joj: 'vitrine JOJ',
}

const FILTRES = [
  { valeur: 'nouvelle', label: 'À traiter' },
  { valeur: 'traitee', label: 'Traitées' },
  { valeur: 'abandonnee', label: 'Abandonnées' },
  { valeur: '', label: 'Toutes' },
]

/**
 * Les demandes de service des voyageurs : transport et repas.
 *
 * La réponse se fait **sur WhatsApp**, pas ici : l'écran sert à ne rien
 * oublier. Une demande dont le message n'est jamais parti n'existe que dans
 * cette liste, d'où le bouton qui ouvre la conversation avec la famille.
 * « Traitée » la sort de la file d'attente, et c'est tout ce que le geste fait.
 */
export default function AdminDemandes() {
  const toast = useToast()
  const [filtre, setFiltre] = useState('nouvelle')
  const [page, setPage] = useState(1)
  const [enCours, setEnCours] = useState<number | null>(null)

  const query = `${filtre ? `statut=${filtre}&` : ''}page=${page}`

  const { donnees, chargement, erreur, reessayer } = useRequete<Page<DemandeService> | DemandeService[]>(
    async (signal) => (await api.get(`/admin/demandes-service?${query}`, { signal })).data,
    `admin-demandes-${query}`,
    { messageErreurParDefaut: 'Impossible de charger les demandes.' }
  )

  const resultat = versPage<DemandeService>(donnees)
  const liste = resultat?.data ?? []

  const changer = async (d: DemandeService, statut: StatutDemandeService) => {
    setEnCours(d.id)
    try {
      await api.patch(`/admin/demandes-service/${d.id}`, { statut })
      toast.succes(statut === 'nouvelle' ? `${d.reference} remise à traiter.` : `${d.reference} ${LIBELLES_STATUT_DEMANDE[statut].toLowerCase()}.`)
      reessayer()
      relireAttentes()
    } catch (err) {
      toast.erreur(messageErreur(err, "La demande n'a pas pu être mise à jour."))
    } finally {
      setEnCours(null)
    }
  }

  return (
    <div>
      <ListeConsole
        titre="Demandes de service"
        sousTitre={<>
          Transport et repas demandés par les voyageurs. La réponse se fait sur
          WhatsApp, sous deux heures comme la page le promet ; marquez la demande traitée
          une fois le prestataire confirmé. Pages, ouvertes ou en aperçu :{' '}
          <Link to="/transport/" className="underline">Transport</Link> ·{' '}
          <Link to="/restauration/" className="underline">Repas</Link> ·{' '}
          <Link to="/joj-dakar-2026/" className="underline">JOJ</Link>.
        </>}
        chargement={chargement}
        erreur={erreur}
        reessayer={reessayer}
        vide={liste.length === 0}
        videIcone={ConciergeBell}
        videTexte={filtre === 'nouvelle'
          ? 'Aucune demande en attente.'
          : 'Aucune demande dans cet état.'}
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
          {liste.map((d) => (
            <article key={d.id} className="panneau commande-admin">
              <div className="commande-admin-haut">
                <div className="commande-admin-titre">
                  <p className="tableau-fort">{d.libelle_prestation}</p>
                  <p className="tableau-second">
                    {d.reference} · {depuis(d.created_at)}
                    {d.origine ? ` · ${ORIGINE[d.origine] ?? d.origine}` : ''}
                    {d.langue === 'en' ? ' · en anglais' : ''}
                  </p>
                </div>
                <div className="commande-ligne-droite">
                  <Badge ton={TON[d.statut]}>{LIBELLES_STATUT_DEMANDE[d.statut]}</Badge>
                </div>
              </div>

              <dl className="commande-admin-faits">
                <div>
                  <dt>Quand</dt>
                  <dd>
                    {dateDuService(d.date_service, 'fr')}{d.heure ? ` à ${d.heure}` : ''}
                    {d.vol ? ` · vol ${d.vol}` : ''} · {d.personnes} pers.
                  </dd>
                </div>
                <div>
                  <dt>Où</dt>
                  <dd>
                    {d.lieu}
                    {d.latitude !== null && d.longitude !== null && (
                      <>
                        {' · '}
                        <a href={lienCarte({ lat: d.latitude, lng: d.longitude })} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                          voir sur la carte
                        </a>
                        {d.precision_m ? ` (à ${d.precision_m} m près)` : ''}
                      </>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Qui</dt>
                  <dd>
                    {d.nom} · {d.telephone}
                    {d.email ? ` · ${d.email}` : ''}
                    {d.delegation ? ` · ${d.delegation}` : ''}
                  </dd>
                </div>
                {d.message && (
                  <div><dt>Précisions</dt><dd>{d.message}</dd></div>
                )}
                {d.statut !== 'nouvelle' && d.traitee_le && (
                  <div>
                    <dt>{LIBELLES_STATUT_DEMANDE[d.statut]}</dt>
                    <dd>le {dateCourte(d.traitee_le)}{d.traitee_par ? ` par ${d.traitee_par.name}` : ''}</dd>
                  </div>
                )}
              </dl>

              <div className="reservation-actions">
                <a
                  href={lienWhatsApp(d.telephone, d.langue === 'en'
                    ? `Hello ${d.nom}, this is PasseTemps about your request ${d.reference}.`
                    : `Bonjour ${d.nom}, c'est PasseTemps au sujet de votre demande ${d.reference}.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondaire btn-sm"
                >
                  <MessageCircle size={15} aria-hidden="true" />
                  <span>Écrire à la famille</span>
                </a>
                {d.statut === 'nouvelle' ? (
                  <>
                    <Button variante="primaire" taille="sm" disabled={enCours === d.id} onClick={() => changer(d, 'traitee')}>
                      Marquer traitée
                    </Button>
                    <Button variante="discret" taille="sm" disabled={enCours === d.id} onClick={() => changer(d, 'abandonnee')}>
                      Abandonner
                    </Button>
                  </>
                ) : (
                  <Button variante="discret" taille="sm" disabled={enCours === d.id} onClick={() => changer(d, 'nouvelle')}>
                    Remettre à traiter
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>

        <Pagination page={resultat} onChange={setPage} unite="demandes" />
      </ListeConsole>
    </div>
  )
}
