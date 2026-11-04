import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, FileText, Plus } from 'lucide-react'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { useRequete } from '../../lib/useRequete'
import { messageErreur } from '../../lib/erreurs'
import { dateCourte, depuis, fcfa } from '../../lib/format'
import { relireAttentes } from '../../lib/attentes'
import { versPage, type Page } from '../../lib/page'
import { LIBELLES_STATUT_DEVIS, lienEnvoiDevis, type Devis } from '../../lib/devis'
import Button, { ButtonLink } from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import BoutonWhatsApp from '../../components/BoutonWhatsApp'
import Pagination from '../../components/console/Pagination'
import ListeConsole from '../../components/console/ListeConsole'

const FILTRES = [
  { valeur: '', label: 'Tous' },
  { valeur: 'site', label: 'Demandés en ligne' },
  { valeur: 'console', label: 'Établis par l’équipe' },
]

const TON = { emis: 'neutre', accepte: 'success', refuse: 'warning' } as const

/**
 * Les devis : ceux que l'équipe établit, et ceux que les clients téléchargent
 * depuis une fiche. Un devis en ligne attend un appel — « Suivi » le sort de
 * « Ce qui attend », et c'est tout ce que le geste fait.
 */
export default function AdminDevis() {
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const origine = params.get('origine') ?? ''
  const [page, setPage] = useState(1)
  const [recherche, setRecherche] = useState('')
  const [enCours, setEnCours] = useState<number | null>(null)

  const query = `${origine ? `origine=${origine}&` : ''}${recherche.trim() ? `recherche=${encodeURIComponent(recherche.trim())}&` : ''}page=${page}`

  const { donnees, chargement, erreur, reessayer } = useRequete<Page<Devis> | Devis[]>(
    async (signal) => (await api.get(`/admin/devis?${query}`, { signal })).data,
    `admin-devis-${query}`,
    { messageErreurParDefaut: 'Impossible de charger les devis.' }
  )
  const resultat = versPage<Devis>(donnees)
  const liste = resultat?.data ?? []

  const suivre = async (d: Devis) => {
    setEnCours(d.id)
    try {
      await api.patch(`/admin/devis/${d.id}`, { suivi: true })
      toast.succes(`${d.numero} marqué comme suivi.`)
      reessayer()
      relireAttentes()
    } catch (err) {
      toast.erreur(messageErreur(err, 'Le devis n’a pas pu être mis à jour.'))
    } finally {
      setEnCours(null)
    }
  }

  return (
    <div>
      <ListeConsole
        titre="Devis"
        sousTitre={<>
          Deux séries : <b>PT-AAAA-NNN</b> pour ceux que vous établissez (cachet possible),
          <b> PT-AAAA-LNNNN</b> pour ceux que les clients téléchargent depuis une fiche, aux prix
          affichés et sans cachet. Rappelez ces derniers pour confirmer.
        </>}
        chargement={chargement}
        erreur={erreur}
        reessayer={reessayer}
        vide={liste.length === 0}
        videIcone={FileText}
        videTexte={recherche ? 'Aucun devis ne correspond.' : 'Aucun devis pour l’instant.'}
        videAction={<ButtonLink to="/admin/devis/nouveau" taille="sm" iconeAvant={<Plus size={15} aria-hidden="true" />}>Nouveau devis</ButtonLink>}
        outils={<div className="console-filtres">
          <div className="console-onglets" role="tablist">
            {FILTRES.map((f) => (
              <button
                key={f.valeur}
                role="tab"
                aria-selected={origine === f.valeur}
                className={`console-onglet${origine === f.valeur ? ' est-actif' : ''}`}
                onClick={() => { setParams(f.valeur ? { origine: f.valeur } : {}); setPage(1) }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            type="search"
            className="champ-controle"
            placeholder="Numéro, client ou hébergement…"
            aria-label="Chercher un devis"
            value={recherche}
            onChange={(e) => { setRecherche(e.target.value); setPage(1) }}
          />
          <ButtonLink to="/admin/devis/nouveau" taille="sm" iconeAvant={<Plus size={15} aria-hidden="true" />}>Nouveau devis</ButtonLink>
        </div>}
      >
        <div className="liste-console">
          {liste.map((d) => {
            const envoi = lienEnvoiDevis(d)
            return (
              <article key={d.id} className="panneau commande-admin">
                <div className="commande-admin-haut">
                  <div className="commande-admin-titre">
                    <p className="tableau-fort">
                      <Link to={`/admin/devis/${d.id}`} className="underline underline-offset-2">{d.numero}</Link> · {d.client_nom}
                    </p>
                    <p className="tableau-second">
                      {d.titre} · {depuis(d.created_at)}
                      {d.occupant_nom ? ` · occupant ${d.occupant_nom}` : ''}
                    </p>
                  </div>
                  <div className="commande-ligne-droite">
                    {d.origine === 'site' && !d.suivi_le && <Badge ton="warning">À rappeler</Badge>}
                    <Badge ton={d.origine === 'site' ? 'neutre' : 'success'}>{d.origine === 'site' ? 'En ligne' : 'Équipe'}</Badge>
                    <Badge ton={TON[d.statut]}>{LIBELLES_STATUT_DEVIS[d.statut]}</Badge>
                  </div>
                </div>

                <dl className="commande-admin-faits">
                  <div>
                    <dt>Séjour</dt>
                    <dd>
                      {d.date_arrivee ? `${dateCourte(d.date_arrivee, 'fr')} → ${d.date_depart ? dateCourte(d.date_depart, 'fr') : '…'}` : '—'}
                      {d.personnes ? ` · ${d.personnes} pers.` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>Total</dt>
                    <dd className="tableau-fort">{fcfa(d.total)}</dd>
                  </div>
                  <div>
                    <dt>Contact</dt>
                    <dd>{[d.client_telephone, d.client_email].filter(Boolean).join(' · ') || '—'}</dd>
                  </div>
                </dl>

                <div className="reservation-actions">
                  <a href={d.pdf} target="_blank" rel="noopener noreferrer" className="btn btn-secondaire btn-sm">
                    <Download size={15} aria-hidden="true" />
                    <span>PDF</span>
                  </a>
                  {envoi && <BoutonWhatsApp href={envoi} taille="sm">Envoyer</BoutonWhatsApp>}
                  <ButtonLink to={`/admin/devis/${d.id}`} variante="discret" taille="sm">Ouvrir</ButtonLink>
                  {d.origine === 'site' && !d.suivi_le && (
                    <Button variante="discret" taille="sm" chargement={enCours === d.id} onClick={() => suivre(d)}>
                      Marquer suivi
                    </Button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
        <Pagination page={resultat} onChange={setPage} unite="devis" />
      </ListeConsole>
    </div>
  )
}
