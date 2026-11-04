import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Copy, Download, Plus, Trash2 } from 'lucide-react'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { erreursParChamp, messageErreur } from '../../lib/erreurs'
import { fcfa } from '../../lib/format'
import { formuleDe, prixDe } from '../../lib/demande'
import { relireAttentes } from '../../lib/attentes'
import {
  LIBELLES_STATUT_DEVIS, ligneDuSejour, lienEnvoiDevis, totalDesLignes,
  type Devis, type LigneDevis, type StatutDevis,
} from '../../lib/devis'
import type { VillaDetail } from '../../types'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Champ, ChampSelection, ChampZoneTexte } from '../../components/ui/Champ'
import BoutonWhatsApp from '../../components/BoutonWhatsApp'

interface Formulaire {
  titre: string
  villa_id: string
  client_nom: string
  occupant_nom: string
  client_telephone: string
  client_email: string
  date_arrivee: string
  date_depart: string
  personnes: string
  validite_jours: string
  conditions: string
  cachet: boolean
  statut: StatutDevis
}

const VIDE: Formulaire = {
  titre: '', villa_id: '', client_nom: '', occupant_nom: '', client_telephone: '', client_email: '',
  date_arrivee: '', date_depart: '', personnes: '', validite_jours: '7', conditions: '', cachet: true, statut: 'emis',
}

const LIGNE_VIDE: LigneDevis = { designation: '', detail: '', quantite: 1, unite: '', prix_unitaire: 0 }

function depuisDevis(d: Devis): Formulaire {
  const jours = d.valable_jusqu_au
    ? Math.max(1, Math.round((Date.parse(d.valable_jusqu_au) - Date.parse(d.date_emission)) / 864e5))
    : 7
  return {
    titre: d.titre,
    villa_id: d.villa_id ? String(d.villa_id) : '',
    client_nom: d.client_nom,
    occupant_nom: d.occupant_nom ?? '',
    client_telephone: d.client_telephone ?? '',
    client_email: d.client_email ?? '',
    date_arrivee: d.date_arrivee ?? '',
    date_depart: d.date_depart ?? '',
    personnes: d.personnes ? String(d.personnes) : '',
    validite_jours: String(jours),
    conditions: d.conditions ?? '',
    cachet: d.cachet,
    statut: d.statut,
  }
}

/**
 * Établir ou reprendre un devis, comme l'équipe le faisait à la main.
 *
 * Choisir une annonce, un logement, une formule et des dates ajoute la ligne du
 * séjour comptée comme la réservation (nuits ou jours, prix de la semaine ou du
 * mois). Tout reste modifiable — l'équipe négocie —, mais chaque montant est
 * recalculé par le serveur : quantité × prix, ligne à ligne.
 */
export default function EditeurDevis() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState<Formulaire>(VIDE)
  const [lignes, setLignes] = useState<LigneDevis[]>([{ ...LIGNE_VIDE }])
  const [erreurs, setErreurs] = useState<Record<string, string>>({})
  const [envoi, setEnvoi] = useState(false)
  const [devis, setDevis] = useState<Devis | null>(null)
  const [annonces, setAnnonces] = useState<{ id: number; nom: string; ville?: string | null }[]>([])
  const [fiche, setFiche] = useState<VillaDetail | null>(null)
  const [choix, setChoix] = useState({ logement: '', tarif: '' })

  useEffect(() => {
    let actif = true
    api.get('/admin/villas?statut=validee&par_page=100')
      .then(({ data }) => { if (actif) setAnnonces(data.data ?? data) })
      .catch((err) => toast.erreur(messageErreur(err, 'La liste des annonces n’a pas pu être chargée.')))
    return () => { actif = false }
  }, [toast])

  useEffect(() => {
    if (!id) return
    let actif = true
    api.get(`/admin/devis/${id}`)
      .then(({ data }) => {
        if (!actif) return
        setDevis(data)
        setForm(depuisDevis(data))
        setLignes(data.lignes)
      })
      .catch((err) => toast.erreur(messageErreur(err, 'Ce devis n’a pas pu être chargé.')))
    return () => { actif = false }
  }, [id, toast])

  useEffect(() => {
    if (!form.villa_id) return
    let actif = true
    api.get(`/villas/${form.villa_id}`)
      .then(({ data }) => { if (actif) setFiche(data.data ?? data) })
      .catch((err) => toast.erreur(messageErreur(err, 'Les logements de cette annonce n’ont pas pu être chargés.')))
    return () => { actif = false }
  }, [form.villa_id, toast])

  const ficheActive = fiche && String(fiche.id) === form.villa_id ? fiche : null
  const logement = ficheActive?.logements.find((l) => String(l.id) === choix.logement)
  const tarif = logement?.tarifs.find((t) => String(t.id) === choix.tarif)
  const total = totalDesLignes(lignes)
  const envoiWhatsApp = devis ? lienEnvoiDevis(devis) : null

  const maj = (cle: keyof Formulaire) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [cle]: e.target.value }))

  const choisirAnnonce = (valeur: string) => {
    const avant = annonces.find((a) => String(a.id) === form.villa_id)
    const apres = annonces.find((a) => String(a.id) === valeur)
    setForm((f) => ({
      ...f,
      villa_id: valeur,
      // Le titre suit l'annonce tant qu'on ne l'a pas réécrit à la main.
      titre: !f.titre || f.titre === avant?.nom ? (apres?.nom ?? f.titre) : f.titre,
    }))
    setChoix({ logement: '', tarif: '' })
  }

  const ajouterSejour = () => {
    if (!logement || !tarif || !form.date_arrivee || !form.date_depart) return
    const ligne = ligneDuSejour(logement, tarif, form.date_arrivee, form.date_depart)
    setLignes((ls) => (ls.length === 1 && !ls[0].designation.trim() ? [ligne] : [...ls, ligne]))
  }

  const majLigne = (i: number, cle: keyof LigneDevis, valeur: string) =>
    setLignes((ls) => ls.map((l, j) => (j === i
      ? { ...l, [cle]: cle === 'quantite' || cle === 'prix_unitaire' ? Number(valeur.replace(/\D/g, '')) : valeur }
      : l)))

  const enregistrer = async (e: FormEvent) => {
    e.preventDefault()
    setErreurs({})
    setEnvoi(true)
    const charge = {
      titre: form.titre.trim(),
      villa_id: form.villa_id ? Number(form.villa_id) : null,
      logement_id: logement ? logement.id : (devis?.logement_id ?? null),
      tarif_id: tarif ? tarif.id : (devis?.tarif_id ?? null),
      client_nom: form.client_nom.trim(),
      occupant_nom: form.occupant_nom.trim() || null,
      client_telephone: form.client_telephone.trim() || null,
      client_email: form.client_email.trim() || null,
      date_arrivee: form.date_arrivee || null,
      date_depart: form.date_depart || null,
      personnes: form.personnes ? Number(form.personnes) : null,
      validite_jours: Number(form.validite_jours) || 7,
      conditions: form.conditions.trim() || null,
      cachet: form.cachet,
      ...(devis ? { statut: form.statut } : {}),
      lignes: lignes.map((l) => ({
        designation: l.designation.trim(),
        detail: l.detail?.trim() || null,
        quantite: Math.max(1, Number(l.quantite) || 1),
        unite: l.unite?.trim() || null,
        prix_unitaire: Math.max(0, Number(l.prix_unitaire) || 0),
      })),
    }
    try {
      const { data } = devis
        ? await api.patch(`/admin/devis/${devis.id}`, charge)
        : await api.post('/admin/devis', charge)
      setDevis(data)
      setForm(depuisDevis(data))
      setLignes(data.lignes)
      toast.succes(devis ? `${data.numero} enregistré.` : `Devis ${data.numero} établi.`)
      if (!devis) navigate(`/admin/devis/${data.id}`, { replace: true })
    } catch (err) {
      setErreurs(erreursParChamp(err))
      toast.erreur(messageErreur(err, 'Le devis n’a pas pu être enregistré.'))
    } finally {
      setEnvoi(false)
    }
  }

  const suivre = async () => {
    if (!devis) return
    try {
      const { data } = await api.patch(`/admin/devis/${devis.id}`, { suivi: true })
      setDevis(data)
      toast.succes(`${data.numero} marqué comme suivi.`)
      relireAttentes()
    } catch (err) {
      toast.erreur(messageErreur(err, 'Le devis n’a pas pu être mis à jour.'))
    }
  }

  const copier = async () => {
    if (!devis) return
    try {
      await navigator.clipboard.writeText(devis.pdf)
      toast.succes('Lien du PDF copié.')
    } catch {
      toast.erreur('Le lien n’a pas pu être copié : ouvrez le PDF et copiez son adresse.')
    }
  }

  return (
    <div>
      <div className="devis-entete">
        <div>
          <Link to="/admin/devis" className="text-sm th-text-2 inline-flex items-center gap-1">
            <ArrowLeft size={14} aria-hidden="true" /> Devis
          </Link>
          <h1 style={{ font: 'var(--t-h2)', margin: '4px 0 0' }}>{devis ? `Devis ${devis.numero}` : 'Nouveau devis'}</h1>
        </div>
        {devis && (
          <div className="console-actions" style={{ flexWrap: 'wrap' }}>
            <Badge ton={devis.origine === 'site' ? 'neutre' : 'success'}>{devis.origine === 'site' ? 'Établi en ligne' : 'Équipe'}</Badge>
            <Badge ton={devis.statut === 'accepte' ? 'success' : devis.statut === 'refuse' ? 'warning' : 'neutre'}>{LIBELLES_STATUT_DEVIS[devis.statut]}</Badge>
            <a href={devis.pdf} target="_blank" rel="noopener noreferrer" className="btn btn-secondaire btn-sm">
              <Download size={15} aria-hidden="true" />
              <span>Télécharger le PDF</span>
            </a>
            {envoiWhatsApp && <BoutonWhatsApp href={envoiWhatsApp} taille="sm">Envoyer au client</BoutonWhatsApp>}
            <Button variante="discret" taille="sm" iconeAvant={<Copy size={15} aria-hidden="true" />} onClick={copier}>Copier le lien</Button>
            {devis.origine === 'site' && !devis.suivi_le && (
              <Button variante="discret" taille="sm" onClick={suivre}>Marquer suivi</Button>
            )}
          </div>
        )}
      </div>

      <form onSubmit={enregistrer} noValidate>
        <div className="console-grille console-grille-2">
          <section className="panneau">
            <h2 className="panneau-titre">Hébergement et séjour</h2>
            <div className="devis-champs">
              <ChampSelection label="Annonce (facultatif)" value={form.villa_id} onChange={(e) => choisirAnnonce(e.target.value)}>
                <option value="">— Aucune, prestation libre —</option>
                {annonces.map((a) => <option key={a.id} value={a.id}>{a.nom}{a.ville ? ` · ${a.ville}` : ''}</option>)}
              </ChampSelection>
              <Champ label="Titre du devis" value={form.titre} onChange={maj('titre')} erreur={erreurs.titre} aide="En tête du document, en capitales : le nom de l’hébergement." required />
              {ficheActive && (
                <>
                  <ChampSelection label="Logement" value={choix.logement} onChange={(e) => setChoix({ logement: e.target.value, tarif: '' })}>
                    <option value="">— Choisir —</option>
                    {ficheActive.logements.map((l) => <option key={l.id} value={l.id}>{l.nom}</option>)}
                  </ChampSelection>
                  {logement && (
                    <ChampSelection label="Formule" value={choix.tarif} onChange={(e) => setChoix((c) => ({ ...c, tarif: e.target.value }))}>
                      <option value="">— Choisir —</option>
                      {logement.tarifs.map((t) => <option key={t.id} value={t.id}>{formuleDe(t, 'fr')} — {prixDe(t, 'fr')}</option>)}
                    </ChampSelection>
                  )}
                </>
              )}
              <div className="devis-deux">
                <Champ label="Arrivée" type="date" value={form.date_arrivee} onChange={maj('date_arrivee')} erreur={erreurs.date_arrivee} />
                <Champ label="Départ" type="date" value={form.date_depart} onChange={maj('date_depart')} erreur={erreurs.date_depart} />
              </div>
              <Champ label="Personnes" type="number" min={1} inputMode="numeric" value={form.personnes} onChange={maj('personnes')} erreur={erreurs.personnes} />
              {ficheActive && (
                <Button
                  type="button"
                  variante="secondaire"
                  taille="sm"
                  iconeAvant={<Plus size={15} aria-hidden="true" />}
                  disabled={!logement || !tarif || !form.date_arrivee || !form.date_depart}
                  onClick={ajouterSejour}
                >
                  Ajouter la ligne du séjour
                </Button>
              )}
            </div>
          </section>

          <section className="panneau">
            <h2 className="panneau-titre">Client</h2>
            <div className="devis-champs">
              <Champ label="Client (société ou personne)" value={form.client_nom} onChange={maj('client_nom')} erreur={erreurs.client_nom} required />
              <Champ label="Occupant (facultatif)" value={form.occupant_nom} onChange={maj('occupant_nom')} erreur={erreurs.occupant_nom} />
              <Champ label="Téléphone (facultatif)" type="tel" inputMode="tel" value={form.client_telephone} onChange={maj('client_telephone')} erreur={erreurs.client_telephone} aide="Pour lui envoyer le devis sur WhatsApp." />
              <Champ label="E-mail (facultatif)" type="email" value={form.client_email} onChange={maj('client_email')} erreur={erreurs.client_email} />
              <Champ label="Valable (jours)" type="number" min={1} inputMode="numeric" value={form.validite_jours} onChange={maj('validite_jours')} erreur={erreurs.validite_jours} />
              {devis && (
                <ChampSelection label="Statut" value={form.statut} onChange={(e) => setForm((f) => ({ ...f, statut: e.target.value as StatutDevis }))}>
                  {(Object.keys(LIBELLES_STATUT_DEVIS) as StatutDevis[]).map((s) => <option key={s} value={s}>{LIBELLES_STATUT_DEVIS[s]}</option>)}
                </ChampSelection>
              )}
            </div>
          </section>
        </div>

        <section className="panneau" style={{ marginTop: 'var(--space-4)' }}>
          <h2 className="panneau-titre">Prestations</h2>
          {erreurs.lignes && <p className="console-erreur">{erreurs.lignes}</p>}
          {lignes.map((l, i) => (
            <div key={i} className="devis-ligne">
              <Champ label="Prestation" value={l.designation} onChange={(e) => majLigne(i, 'designation', e.target.value)} erreur={erreurs[`lignes.${i}.designation`]} />
              <Champ label="Détail (facultatif)" value={l.detail ?? ''} onChange={(e) => majLigne(i, 'detail', e.target.value)} />
              <Champ label="Quantité" inputMode="numeric" value={String(l.quantite)} onChange={(e) => majLigne(i, 'quantite', e.target.value)} erreur={erreurs[`lignes.${i}.quantite`]} />
              <Champ label="Unité" placeholder="nuitée" value={l.unite ?? ''} onChange={(e) => majLigne(i, 'unite', e.target.value)} />
              <Champ label="Prix unitaire (FCFA)" inputMode="numeric" value={String(l.prix_unitaire)} onChange={(e) => majLigne(i, 'prix_unitaire', e.target.value)} erreur={erreurs[`lignes.${i}.prix_unitaire`]} />
              <p className="devis-ligne-montant">{fcfa((Number(l.quantite) || 1) * (Number(l.prix_unitaire) || 0))}</p>
              <Button
                type="button"
                variante="discret"
                taille="sm"
                aria-label={`Retirer la prestation ${i + 1}`}
                disabled={lignes.length === 1}
                onClick={() => setLignes((ls) => ls.filter((_, j) => j !== i))}
                iconeAvant={<Trash2 size={15} aria-hidden="true" />}
              />
            </div>
          ))}
          <div className="devis-pied">
            <Button type="button" variante="discret" taille="sm" iconeAvant={<Plus size={15} aria-hidden="true" />} onClick={() => setLignes((ls) => [...ls, { ...LIGNE_VIDE }])}>
              Ajouter une prestation
            </Button>
            <p className="devis-total">Total à payer <strong>{fcfa(total)}</strong></p>
          </div>
        </section>

        <section className="panneau" style={{ marginTop: 'var(--space-4)' }}>
          <h2 className="panneau-titre">Conditions et cachet</h2>
          <div className="devis-champs">
            <ChampZoneTexte
              label="Conditions et observations (facultatif)"
              rows={3}
              value={form.conditions}
              onChange={maj('conditions')}
              erreur={erreurs.conditions}
              aide="Vide, le devis reprend la phrase habituelle : « La réservation sera confirmée selon les modalités convenues avec PasseTemps. »"
            />
            <label className="devis-coche">
              <input type="checkbox" checked={form.cachet} onChange={(e) => setForm((f) => ({ ...f, cachet: e.target.checked }))} />
              <span>Apposer le cachet PasseTemps</span>
            </label>
          </div>
        </section>

        <div className="console-actions" style={{ marginTop: 'var(--space-4)' }}>
          <Button type="submit" variante="primaire" chargement={envoi} disabled={!form.titre.trim() || !form.client_nom.trim() || !lignes.some((l) => l.designation.trim())}>
            {devis ? 'Enregistrer' : 'Établir le devis'}
          </Button>
        </div>
      </form>
    </div>
  )
}
