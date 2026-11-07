import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Receipt } from 'lucide-react'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { useRequete } from '../../lib/useRequete'
import { messageErreur } from '../../lib/erreurs'
import { aujourdhui, dateCourte, fcfa } from '../../lib/format'
import { lienAppel } from '../../lib/contact'
import { enregistrerFichier } from '../../lib/telecharger'
import { versPage, type Page } from '../../lib/page'
import type { Reglement, SoldeOuvert, TotalParMoyen } from '../../lib/reglements'
import Button, { ButtonLink } from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Pagination from '../../components/console/Pagination'
import ListeConsole from '../../components/console/ListeConsole'

type Reponse = Page<Reglement> & {
  totaux: TotalParMoyen[]
  soldes: SoldeOuvert[]
  moyens: Record<string, string>
}

/**
 * Le registre de l'argent reçu hors du site : ce qui est entré, par quel moyen, et
 * ce qui reste à recevoir. Un règlement s'enregistre depuis son devis, jamais d'ici :
 * sans devis, on ne saurait ni quel séjour bloquer, ni à qui reverser.
 */
export default function AdminReglements() {
  const toast = useToast()
  const [moyen, setMoyen] = useState('')
  const [recherche, setRecherche] = useState('')
  const [terme, setTerme] = useState('')
  const [page, setPage] = useState(1)
  const [exportEnCours, setExportEnCours] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => { setTerme(recherche.trim()); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [recherche])

  const criteres = `${moyen ? `moyen=${moyen}&` : ''}${terme ? `recherche=${encodeURIComponent(terme)}&` : ''}`

  const { donnees, chargement, erreur, reessayer } = useRequete<Reponse>(
    async (signal) => (await api.get(`/admin/reglements?${criteres}page=${page}`, { signal })).data,
    `admin-reglements-${criteres}${page}`,
    { messageErreurParDefaut: 'Impossible de charger les règlements.' },
  )
  const resultat = versPage<Reglement>(donnees)
  const liste = resultat?.data ?? []
  const soldes = donnees?.soldes ?? []
  const totaux = donnees?.totaux ?? []
  const totalGeneral = totaux.reduce((s, t) => s + t.total, 0)

  const exporter = async () => {
    setExportEnCours(true)
    try {
      const { data } = await api.get(`/admin/reglements/export?${criteres}`, { responseType: 'blob' })
      enregistrerFichier(data as Blob, `PasseTemps-reglements-${aujourdhui()}.csv`)
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
        titre="Règlements"
        sousTitre="L’argent reçu hors du site, et ce qu’il reste à recevoir. Un règlement s’enregistre depuis son devis."
        chargement={chargement}
        erreur={erreur}
        reessayer={reessayer}
        vide={liste.length === 0 && soldes.length === 0}
        videIcone={Receipt}
        videTexte={recherche || moyen ? 'Aucun règlement ne correspond.' : 'Aucun règlement pour l’instant. Ouvrez un devis pour enregistrer une somme reçue.'}
        videAction={<ButtonLink to="/admin/devis" taille="sm" variante="secondaire">Voir les devis</ButtonLink>}
        outils={<div className="console-filtres">
          <div className="console-onglets" role="tablist">
            <button role="tab" aria-selected={moyen === ''} className={`console-onglet${moyen === '' ? ' est-actif' : ''}`} onClick={() => { setMoyen(''); setPage(1) }}>Tous</button>
            {Object.entries(donnees?.moyens ?? {}).map(([cle, nom]) => (
              <button key={cle} role="tab" aria-selected={moyen === cle} className={`console-onglet${moyen === cle ? ' est-actif' : ''}`} onClick={() => { setMoyen(cle); setPage(1) }}>{nom}</button>
            ))}
          </div>
          <input
            type="search"
            className="champ-controle"
            placeholder="Reçu, client, devis ou référence…"
            aria-label="Chercher un règlement"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
          <Button variante="secondaire" taille="sm" chargement={exportEnCours} iconeAvant={<Download size={15} aria-hidden="true" />} onClick={exporter}>
            Exporter en CSV
          </Button>
        </div>}
      >
        {totaux.length > 0 && (
          <section className="panneau reglements-totaux" aria-label="Total reçu par moyen">
            <dl className="reglements-chiffres">
              <div><dt>Reçu au total</dt><dd>{fcfa(totalGeneral)}</dd></div>
              {totaux.map((t) => (
                <div key={t.moyen}><dt>{t.libelle}</dt><dd>{fcfa(t.total)}</dd></div>
              ))}
            </dl>
          </section>
        )}

        {soldes.length > 0 && (
          <section className="panneau reglements-soldes">
            <h2 className="panneau-titre">Reste à recevoir</h2>
            <p className="tableau-second">Tant qu’un dossier reste ouvert, le propriétaire n’est pas payé. Le plus proche de l’arrivée d’abord.</p>
            <ul className="reglements-liste">
              {soldes.map((s) => {
                const termine = s.date_fin <= aujourdhui()
                return (
                  <li key={`${s.devis_id}-${s.date_debut}`}>
                    <div className="reglements-ligne">
                      <p className="tableau-fort">
                        <span className="reglements-somme">{fcfa(s.solde)}</span> · {s.client ?? 'Client'}
                        {termine && <> · <Badge ton="danger">Séjour terminé</Badge></>}
                      </p>
                      <p className="tableau-second">
                        {s.hebergement} · {dateCourte(s.date_debut, 'fr')} → {dateCourte(s.date_fin, 'fr')} · {fcfa(s.encaisse)} reçus
                      </p>
                    </div>
                    <div className="reservation-actions">
                      {s.telephone && <a href={lienAppel(s.telephone)} className="btn btn-secondaire btn-sm"><span>Appeler</span></a>}
                      {s.devis_id && <ButtonLink to={`/admin/devis/${s.devis_id}`} variante="discret" taille="sm">Ouvrir le devis</ButtonLink>}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {liste.length === 0 && soldes.length > 0 && (
          <p className="tableau-second">Aucun règlement ne correspond à cette recherche.</p>
        )}

        {liste.length > 0 && (
          <section className="panneau">
            <h2 className="panneau-titre">Registre</h2>
            <ul className="reglements-liste">
              {liste.map((r) => (
                <li key={r.id} className={r.statut === 'annule' ? 'est-annule' : undefined}>
                  <div className="reglements-ligne">
                    <p className="tableau-fort">
                      <span className="reglements-somme">{fcfa(r.montant)}</span> · {r.client_nom}
                      {r.statut === 'annule' && <> · <Badge ton="danger">Annulé</Badge></>}
                    </p>
                    <p className="tableau-second">
                      {r.numero} · {r.libelle_moyen} · reçu le {dateCourte(r.recu_le, 'fr')}
                      {r.reference ? ` · réf. ${r.reference}` : ''} · noté par {r.createur_nom}
                    </p>
                    {r.statut === 'annule' && r.annule_motif && (
                      <p className="tableau-second">Annulé par {r.annule_par_nom} : {r.annule_motif}</p>
                    )}
                  </div>
                  <div className="reservation-actions">
                    <a href={r.pdf} target="_blank" rel="noopener noreferrer" className="btn btn-secondaire btn-sm">
                      <Download size={15} aria-hidden="true" />
                      <span>Reçu</span>
                    </a>
                    {r.devis_id && (
                      <Link to={`/admin/devis/${r.devis_id}`} className="btn btn-discret btn-sm">
                        <span>{r.devis_numero ?? 'Devis'}</span>
                      </Link>
                    )}
                    {/* Le reçu d'un trajet se défait avec son paiement, sur la demande. */}
                    {!r.devis_id && r.demande_service_id && (
                      <Link to="/admin/demandes" className="btn btn-discret btn-sm">
                        <span>Trajet · {r.devis_numero ?? 'demande'}</span>
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={resultat} onChange={setPage} unite="règlements" />
          </section>
        )}
      </ListeConsole>
    </div>
  )
}
