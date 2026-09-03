import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, Star, ExternalLink, Building2, Check, X, EyeOff, AlertTriangle } from 'lucide-react'
import api from '../../services/api'
import { useRequete } from '../../lib/useRequete'
import { useToast } from '../../context/ToastContext'
import { messageErreur } from '../../lib/erreurs'
import { depuis } from '../../lib/format'
import Button from '../../components/ui/Button'
import { ChampZoneTexte } from '../../components/ui/Champ'
import Badge from '../../components/ui/Badge'
import Pagination from '../../components/console/Pagination'
import { versPage, type Page } from '../../lib/page'

interface Villa {
  id: number
  nom: string
  ville: string
  statut: string
  vedette: boolean
  description: string
  telephone: string
  proprietaire: { name: string; email: string; phone: string | null }
  created_at: string
  /** Servi seulement sur l'onglet Brouillons : l'étape où le propriétaire a calé. */
  manques?: { etape: string; message: string }[]
}

const ONGLETS = [
  { valeur: 'en_attente', label: 'En attente' },
  // Ajouté le 3 septembre 2026. Ces annonces n'apparaissaient nulle part :
  // leurs propriétaires croyaient avoir publié, et l'écran affichait
  // « tout est traité ».
  { valeur: 'brouillon', label: 'Brouillons' },
  { valeur: 'validee', label: 'Validées' },
  { valeur: 'rejetee', label: 'Rejetées' },
]

export default function AdminVillas() {
  const toast = useToast()
  /*
   * L'onglet se lit dans l'URL, pas seulement dans l'état.
   *
   * « Ce qui attend » renvoie ici avec `?statut=brouillon`. Sans cette
   * lecture, le lien promettait des brouillons et ouvrait la file d'attente —
   * une promesse cassée à l'endroit précis où l'on venait chercher quelque
   * chose. L'onglet reste ensuite piloté par les clics, et l'URL suit.
   */
  const [parametres, setParametres] = useSearchParams()
  const demande = parametres.get('statut')
  const [statut, setStatut] = useState(
    ONGLETS.some((o) => o.valeur === demande) ? (demande as string) : 'en_attente'
  )
  // Le panneau de motif : ouvert sur une villa, il porte la raison du retrait.
  const [aRetirer, setARetirer] = useState<Villa | null>(null)
  const [motif, setMotif] = useState('')
  const [recherche, setRecherche] = useState('')
  const [terme, setTerme] = useState('')
  const [page, setPage] = useState(1)
  const [enCours, setEnCours] = useState<number | null>(null)

  // La frappe ne déclenche pas une requête par caractère : sur un serveur
  // mono-processus, chaque lettre coûterait un aller-retour.
  useEffect(() => {
    const t = setTimeout(() => { setTerme(recherche); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [recherche])

  const requete = `statut=${statut}&page=${page}${terme ? `&recherche=${encodeURIComponent(terme)}` : ''}`

  const { donnees, chargement, erreur, reessayer } = useRequete<Page<Villa> | Villa[]>(
    async (signal) => (await api.get(`/admin/villas?${requete}`, { signal })).data,
    requete,
    { messageErreurParDefaut: 'Impossible de charger les villas.' }
  )

  const page_ = versPage(donnees)
  const villas = page_?.data ?? []

  const changerStatut = async (villa: Villa, nouveau: 'validee' | 'rejetee', raison?: string) => {
    setEnCours(villa.id)
    try {
      await api.patch(`/admin/villas/${villa.id}/statut`, {
        statut: nouveau,
        // Le motif ne part qu'au refus : valider n'a pas à se justifier.
        ...(raison ? { motif: raison } : {}),
      })
      toast.succes(
        nouveau === 'validee'
          ? `« ${villa.nom} » validée et publiée.`
          : `« ${villa.nom} » retirée. Le propriétaire reçoit le motif.`
      )
      setARetirer(null)
      setMotif('')
      reessayer()
    } catch (err) {
      toast.erreur(messageErreur(err, "La décision n'a pas pu être enregistrée."))
    } finally {
      setEnCours(null)
    }
  }

  const basculerVedette = async (villa: Villa) => {
    setEnCours(villa.id)
    try {
      await api.patch(`/admin/villas/${villa.id}/vedette`)
      reessayer()
    } catch (err) {
      toast.erreur(messageErreur(err, 'La mise en vedette a échoué.'))
    } finally {
      setEnCours(null)
    }
  }

  const changerOnglet = (valeur: string) => {
    setStatut(valeur)
    setPage(1)
    // L'URL suit l'onglet : la page se recharge et se partage telle qu'on la voit.
    setParametres(valeur === 'en_attente' ? {} : { statut: valeur }, { replace: true })
  }

  return (
    <div>
      <h1 className="console-titre">Hébergements</h1>
      <p className="console-sous-titre">
        Chaque annonce passe par ici avant d'être visible du public.
      </p>

      <div className="console-filtres">
        <div className="console-onglets" role="tablist">
          {ONGLETS.map((o) => (
            <button
              key={o.valeur}
              role="tab"
              aria-selected={statut === o.valeur}
              onClick={() => changerOnglet(o.valeur)}
              className={`console-onglet${statut === o.valeur ? ' est-actif' : ''}`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="console-recherche">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            className="champ-controle"
            placeholder="Nom ou ville…"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            aria-label="Rechercher un hébergement"
          />
        </div>
      </div>

      {erreur && !chargement && (
        <div className="console-erreur" role="alert">
          {erreur}
          <Button variante="secondaire" taille="sm" onClick={reessayer} >
            Réessayer
          </Button>
        </div>
      )}

      {chargement ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {[1, 2, 3].map((n) => (
            <div key={n} className="panneau">
              <div className="skeleton" style={{ height: 16, width: '35%', borderRadius: 6, marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 12, width: '55%', borderRadius: 6 }} />
            </div>
          ))}
        </div>
      ) : villas.length === 0 ? (
        <div className="console-vide">
          <span className="console-vide-icone"><Building2 size={22} /></span>
          <p>
            {terme
              ? <>Aucun hébergement ne correspond à <strong>{terme}</strong>.</>
              : statut === 'en_attente'
                ? <>Aucune annonce en attente. <strong>Tout est traité.</strong></>
                : statut === 'brouillon'
                  ? <>Aucun brouillon en cours. Personne n'est bloqué en chemin.</>
                  : 'Aucun hébergement dans cette catégorie.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {villas.map((villa) => (
            <article key={villa.id} className="panneau">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 4, flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, font: 'var(--t-h3)', color: 'var(--text-1)' }}>{villa.nom}</h2>
                    {villa.vedette && <Badge ton="vedette">Vedette</Badge>}
                  </div>

                  <p style={{ margin: 0, font: 'var(--t-body-sm)', color: 'var(--text-2)' }}>
                    {villa.ville} · {villa.telephone}
                  </p>
                  <p style={{ margin: '2px 0 0', font: 'var(--t-caption)', color: 'var(--text-3)' }}>
                    {villa.proprietaire?.name}
                    {/* Le numéro d'abord sur un brouillon : c'est un appel
                        qu'il faut passer, pas un courriel à écrire. */}
                    {villa.proprietaire?.phone && <> · {villa.proprietaire.phone}</>}
                    {villa.proprietaire?.email && <> · {villa.proprietaire.email}</>}
                    {' · '}{statut === 'brouillon' ? 'commencée' : 'déposée'} {depuis(villa.created_at)}
                  </p>

                  {/* Ce qui manque, dit à l'exploitant dans les mots qu'il
                      pourra répéter au téléphone. Sans cette liste, voir le
                      brouillon ne servirait qu'à constater. */}
                  {statut === 'brouillon' && (
                    <div className="console-note console-note-alerte" style={{ marginTop: 'var(--space-3)', marginBottom: 0 }}>
                      <AlertTriangle size={16} aria-hidden="true" />
                      <div>
                        {(villa.manques ?? []).length === 0 ? (
                          <p>
                            <strong>Rien ne manque.</strong> Cette annonce est complète : il ne reste
                            au propriétaire qu'à appuyer sur « Publier » depuis son espace.
                          </p>
                        ) : (
                          <>
                            <p><strong>Ce qu'il reste à faire au propriétaire :</strong></p>
                            <ul style={{ margin: '4px 0 0', paddingLeft: '1.1em' }}>
                              {villa.manques?.map((m) => (
                                <li key={m.etape + m.message} style={{ font: 'var(--t-body-sm)' }}>{m.message}</li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {villa.description && (
                    <p className="line-clamp-2" style={{ margin: 'var(--space-2) 0 0', font: 'var(--t-body-sm)', color: 'var(--text-3)' }}>
                      {villa.description}
                    </p>
                  )}

                  {/* Ouvert dans un onglet : décider sans avoir vu l'annonce
                      telle que le public la verra n'a pas de sens, et revenir
                      en arrière ferait perdre la position dans la liste. */}
                  {statut !== 'brouillon' && (
                  <Link
                    to={`/hebergements/${villa.id}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 'var(--space-3)',
                      font: 'var(--t-body-sm)', color: 'var(--accent)', textDecoration: 'none',
                    }}
                  >
                    Voir l'annonce <ExternalLink size={13} />
                  </Link>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {statut === 'en_attente' && (
                    <>
                      <Button
                        variante="primaire" taille="sm"
                        onClick={() => changerStatut(villa, 'validee')}
                        disabled={enCours === villa.id}
                        iconeAvant={<Check size={15} />}
                      >
                        Valider
                      </Button>
                      <Button
                        variante="secondaire" taille="sm"
                        onClick={() => changerStatut(villa, 'rejetee')}
                        disabled={enCours === villa.id}
                        iconeAvant={<X size={15} />}
                      >
                        Rejeter
                      </Button>
                    </>
                  )}

                  {statut === 'validee' && (
                    <>
                      <Button
                        variante={villa.vedette ? 'primaire' : 'secondaire'}
                        taille="sm"
                        onClick={() => basculerVedette(villa)}
                        disabled={enCours === villa.id}
                        iconeAvant={<Star size={15} fill={villa.vedette ? 'currentColor' : 'none'} />}
                      >
                        {villa.vedette ? 'En vedette' : 'Mettre en vedette'}
                      </Button>

                      {/* Une annonce en ligne doit pouvoir être retirée : elle
                          peut se révéler frauduleuse, ou son propriétaire en
                          demander le retrait. En discret, jamais en accent —
                          retirer doit être possible, pas facile. */}
                      <Button
                        variante="discret"
                        taille="sm"
                        onClick={() => { setARetirer(villa); setMotif('') }}
                        disabled={enCours === villa.id}
                        iconeAvant={<EyeOff size={15} />}
                      >
                        Retirer
                      </Button>
                    </>
                  )}

                  {statut === 'rejetee' && (
                    <Button
                      variante="secondaire" taille="sm"
                      onClick={() => changerStatut(villa, 'validee')}
                      disabled={enCours === villa.id}
                      iconeAvant={<Check size={15} />}
                    >
                      Revenir sur le refus
                    </Button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Pagination page={page_} onChange={setPage} unite="villa" />

      {aRetirer && (
        <>
          {/* Le clic à côté ne referme pas quand un motif est commencé : le
              perdre obligerait à le réécrire, et on finit par retirer sans
              motif — ce que la règle cherche justement à empêcher. */}
          <div
            className="console-voile"
            onClick={() => { if (!motif.trim()) setARetirer(null) }}
            aria-hidden="true"
          />
          <div className="modale" role="dialog" aria-modal="true" aria-labelledby="titre-retrait">
            <div className="modale-entete">
              <h2 id="titre-retrait" className="panneau-titre" style={{ margin: 0 }}>
                Retirer « {aRetirer.nom} »
              </h2>
              <Button
                variante="discret" taille="sm" onClick={() => setARetirer(null)}
                iconeAvant={<X size={18} />} aria-label="Fermer"
              />
            </div>

            <p className="console-sous-titre">
              L'annonce quitte le site immédiatement. <strong>Le propriétaire
              reçoit ce motif</strong> — c'est ce qui lui permet de corriger ou
              de contester.
            </p>

            <div className="modale-formulaire">
              <ChampZoneTexte
                label="Motif du retrait"
                aide="Une phrase suffit. Elle sera lue par le propriétaire et consignée au journal."
                rows={3}
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                maxLength={500}
                required
              />
            </div>

            <div className="modale-actions">
              <Button variante="secondaire" onClick={() => setARetirer(null)}>Annuler</Button>
              <Button
                variante="primaire"
                onClick={() => changerStatut(aRetirer, 'rejetee', motif.trim())}
                disabled={motif.trim().length < 10 || enCours === aRetirer.id}
                chargement={enCours === aRetirer.id}
              >
                Retirer l'annonce
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}