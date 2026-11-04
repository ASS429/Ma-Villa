import { useState, type FormEvent } from 'react'
import { Download, FileText } from 'lucide-react'
import api from '../services/api'
import Button from './ui/Button'
import { Champ } from './ui/Champ'
import { erreursParChamp, messageErreur } from '../lib/erreurs'
import { dateCourte, fcfa } from '../lib/format'
import { useLangue } from '../i18n/langue'
import { TEXTES_HEBERGEMENT } from '../i18n/hebergement'
import { choixDuDevis } from '../lib/demande'

export interface DevisEtabli {
  numero: string
  total: number
  pdf: string
  valable_jusqu_au?: string
  /** Ce pour quoi il a été établi : changer le choix le rend caduc. */
  pour: string
}

interface Props {
  logementId?: number
  tarifId?: number
  debut: string
  fin: string
  personnes: number
  devis: DevisEtabli | null
  onEtabli: (devis: DevisEtabli) => void
  /**
   * Le devis tient lieu de contact (fiche fermée à la réservation en ligne) :
   * le formulaire est ouvert d'emblée, sans « occupant », et la suite mène à
   * WhatsApp. Sinon, c'est un document de plus, à la demande.
   */
  contact?: boolean
}

const VIDE = { client_nom: '', occupant_nom: '', telephone: '', email: '', site_web: '' }

/**
 * « Télécharger un devis » sur la fiche : des entreprises le demandent pour
 * payer, et l'équipe les faisait à la main.
 *
 * Le serveur reprend le logement, la formule et les dates choisis, recalcule le
 * prix et refuse ce qu'une réservation refuserait : le devis ne promet que ce
 * qui se réserve. On ne demande ici que ce qu'un devis porte en plus — au nom
 * de qui il est établi, et un numéro pour répondre : sans lui, le devis
 * enregistré ne mène à personne.
 */
export default function DemandeDevis({ logementId, tarifId, debut, fin, personnes, devis, onEtabli, contact = false }: Props) {
  const { langue } = useLangue()
  const t = TEXTES_HEBERGEMENT[langue].devis
  const [deplie, setOuvert] = useState(false)
  const ouvert = contact || deplie
  const [champs, setChamps] = useState(VIDE)
  const [erreurs, setErreurs] = useState<Record<string, string>>({})
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)

  const pour = choixDuDevis(logementId, tarifId, debut, fin, personnes)
  const pret = Boolean(logementId && tarifId && debut && fin)
  const actuel = devis && devis.pour === pour ? devis : null

  const maj = (cle: keyof typeof VIDE) => (e: { target: { value: string } }) =>
    setChamps((c) => ({ ...c, [cle]: e.target.value }))

  const etablir = async (e: FormEvent) => {
    e.preventDefault()
    setErreurs({})
    setErreur('')
    setEnvoi(true)
    try {
      const { data } = await api.post('/devis', {
        logement_id: logementId,
        tarif_id: tarifId,
        date_debut: debut,
        date_fin: fin,
        nb_personnes: personnes,
        ...champs,
        langue,
      })
      if (data.numero) onEtabli({ ...data, pour })
      setOuvert(false)
    } catch (err) {
      const parChamp = erreursParChamp(err)
      setErreurs(parChamp)
      // Une erreur sur les dates ou la formule concerne les champs du dessus.
      const ailleurs = ['date_debut', 'date_fin', 'tarif_id', 'nb_personnes'].map((c) => parChamp[c]).find(Boolean)
      setErreur(ailleurs ?? (Object.keys(parChamp).length ? '' : messageErreur(err, t.impossible)))
    } finally {
      setEnvoi(false)
    }
  }

  if (!pret) {
    return <p className="text-xs th-text-3 leading-relaxed">{contact ? t.quandPretContact : t.quandPret}</p>
  }

  if (actuel) {
    return (
      <div className="devis-pret" role="status">
        <p className="text-sm th-text-1 font-medium">{t.pret(actuel.numero, fcfa(actuel.total))}</p>
        <a href={actuel.pdf} target="_blank" rel="noopener noreferrer" className="btn btn-secondaire btn-sm w-full justify-center">
          <Download size={15} aria-hidden="true" />
          <span>{t.telecharger}</span>
        </a>
        <p className="text-xs th-text-3 leading-relaxed">
          {actuel.valable_jusqu_au ? t.valable(dateCourte(actuel.valable_jusqu_au, langue)) : ''} {contact ? t.suiteContact : t.suite}
        </p>
      </div>
    )
  }

  if (!ouvert) {
    return (
      <Button type="button" variante="secondaire" taille="sm" bloc iconeAvant={<FileText size={15} aria-hidden="true" />} onClick={() => setOuvert(true)}>
        {t.ouvrir}
      </Button>
    )
  }

  return (
    <form className="devis-formulaire" onSubmit={etablir} noValidate>
      <p className="text-sm th-text-1 font-medium">{contact ? t.contactTitre : t.titre}</p>
      <p className="text-xs th-text-3 leading-relaxed">{contact ? t.contactAide : t.aide}</p>
      <Champ label={contact ? t.votreNom : t.auNomDe} value={champs.client_nom} onChange={maj('client_nom')} erreur={erreurs.client_nom} autoComplete={contact ? 'name' : 'organization'} required />
      {!contact && (
        <Champ label={t.occupant} value={champs.occupant_nom} onChange={maj('occupant_nom')} erreur={erreurs.occupant_nom} autoComplete="name" />
      )}
      <Champ label={t.telephone} type="tel" inputMode="tel" value={champs.telephone} onChange={maj('telephone')} erreur={erreurs.telephone} autoComplete="tel" required />
      <Champ label={t.email} type="email" value={champs.email} onChange={maj('email')} erreur={erreurs.email} autoComplete="email" />

      {/* Le champ piège, hors de l'écran : voir la demande de service. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label>
          Site web
          <input type="text" tabIndex={-1} autoComplete="off" value={champs.site_web} onChange={maj('site_web')} />
        </label>
      </div>

      {erreur && <p className="text-xs" style={{ color: 'var(--danger)' }} role="alert">{erreur}</p>}

      <div className="devis-actions">
        <Button type="submit" variante="primaire" taille="sm" chargement={envoi} disabled={!champs.client_nom.trim() || !champs.telephone.trim()}>
          {contact ? t.etablirContact : t.etablir}
        </Button>
        {!contact && (
          <Button type="button" variante="discret" taille="sm" onClick={() => setOuvert(false)}>
            {t.annuler}
          </Button>
        )}
      </div>
    </form>
  )
}
