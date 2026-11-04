import { useState, type FormEvent } from 'react'
import { PartyPopper } from 'lucide-react'
import api from '../services/api'
import Button from './ui/Button'
import { Champ, ChampZoneTexte } from './ui/Champ'
import BoutonWhatsApp from './BoutonWhatsApp'
import { erreursParChamp, messageErreur } from '../lib/erreurs'
import { lienWhatsApp } from '../lib/contact'
import { lienDeLaFiche } from '../lib/demande'
import { aujourdhui } from '../lib/format'
import {
  BESOINS_PARTICULIERS, TYPES_PARTICULIERS, budgetLisible, datesLisibles, lignesDuMessage,
  type BesoinParticulier, type TypeParticuliere,
} from '../lib/particuliere'
import { useConfig } from '../context/ConfigContext'
import { useLangue } from '../i18n/langue'
import { TEXTES_HEBERGEMENT } from '../i18n/hebergement'

interface Props {
  villa: { id: number; nom: string }
  /** Ce que le visiteur a déjà saisi sur la fiche : on ne le lui redemande pas. */
  debut?: string
  fin?: string
  personnes?: number
}

/**
 * La demande particulière d'une fiche : un anniversaire de trente invités, un
 * séminaire, un groupe, un long séjour — ce qu'une réservation ne sait pas
 * dire et qui arrivait par e-mail, en vrac.
 *
 * Elle s'enregistre d'abord (la console la garde, même si le message WhatsApp
 * ne part jamais), puis propose de l'envoyer sur WhatsApp, déjà rédigée.
 */
export default function DemandeParticuliere({ villa, debut = '', fin = '', personnes }: Props) {
  const { langue } = useLangue()
  const t = TEXTES_HEBERGEMENT[langue].particuliere
  const { reservations } = useConfig()
  const [ouvert, setOuvert] = useState(false)
  const [type, setType] = useState<TypeParticuliere>('evenement')
  const [besoins, setBesoins] = useState<BesoinParticulier[]>([])
  const [champs, setChamps] = useState({
    date_debut: '', date_fin: '', personnes_sejour: '', invites: '', budget: '',
    message: '', nom: '', telephone: '', email: '', site_web: '',
  })
  const [aConfirmer, setAConfirmer] = useState(false)
  const [erreurs, setErreurs] = useState<Record<string, string>>({})
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [reference, setReference] = useState<string | null>(null)

  const maj = (cle: keyof typeof champs) => (e: { target: { value: string } }) =>
    setChamps((c) => ({ ...c, [cle]: e.target.value }))

  const ouvrir = () => {
    // Les dates et le nombre de personnes déjà choisis sur la fiche suivent.
    setChamps((c) => ({
      ...c,
      date_debut: c.date_debut || debut,
      date_fin: c.date_fin || fin,
      personnes_sejour: c.personnes_sejour || (personnes && personnes > 1 ? String(personnes) : ''),
    }))
    setOuvert(true)
  }

  const basculer = (b: BesoinParticulier) =>
    setBesoins((bs) => (bs.includes(b) ? bs.filter((x) => x !== b) : [...bs, b]))

  const avecInvites = type === 'evenement' || type === 'seminaire'
  const nombre = (v: string) => (v.trim() ? Number(v.replace(/\D/g, '')) : null)

  const envoyer = async (e: FormEvent) => {
    e.preventDefault()
    setErreurs({})
    setErreur('')
    setEnvoi(true)
    try {
      const { data } = await api.post('/demandes-particulieres', {
        villa_id: villa.id,
        type,
        date_debut: champs.date_debut || null,
        date_fin: champs.date_fin || null,
        dates_a_confirmer: aConfirmer,
        personnes_sejour: nombre(champs.personnes_sejour),
        invites: avecInvites ? nombre(champs.invites) : null,
        besoins,
        budget: nombre(champs.budget),
        message: champs.message,
        nom: champs.nom,
        telephone: champs.telephone || null,
        email: champs.email || null,
        langue,
        site_web: champs.site_web,
      })
      setReference(data.reference ?? '')
    } catch (err) {
      const parChamp = erreursParChamp(err)
      setErreurs(parChamp)
      setErreur(Object.keys(parChamp).length ? '' : messageErreur(err, t.impossible))
    } finally {
      setEnvoi(false)
    }
  }

  const message = () => [
    t.messageIntro,
    '',
    ...lignesDuMessage([
      [t.libelles.reference, reference],
      [t.libelles.hebergement, villa.nom],
      [t.libelles.type, t.types[type]],
      [t.libelles.dates, datesLisibles({ date_debut: champs.date_debut || null, date_fin: champs.date_fin || null, dates_a_confirmer: aConfirmer }, langue, t.aConfirmerCourt)],
      [t.libelles.personnes, nombre(champs.personnes_sejour)],
      [t.libelles.invites, avecInvites ? nombre(champs.invites) : null],
      [t.libelles.besoins, besoins.map((b) => t.listeBesoins[b]).join(', ')],
      [t.libelles.budget, budgetLisible(nombre(champs.budget))],
      [t.libelles.demande, champs.message.trim()],
      [t.libelles.lien, lienDeLaFiche(villa.id)],
    ], langue === 'fr' ? ' : ' : ': '),
  ].join('\n')

  return (
    <section id="demande-particuliere" className="particuliere" style={{ scrollMarginTop: 96 }}>
      <h2 className="text-lg font-medium mb-2 flex items-center gap-2">
        <PartyPopper size={18} aria-hidden="true" /> {t.titre}
      </h2>
      <p className="text-sm th-text-2 mb-4 leading-relaxed">{t.texte}</p>

      {reference !== null ? (
        <div className="particuliere-envoyee" role="status">
          <p className="font-medium th-text-1">{t.enregistree(reference)}</p>
          <p className="text-sm th-text-2 leading-relaxed">{t.suite}</p>
          <BoutonWhatsApp href={lienWhatsApp(reservations.contact.telephone, message())} className="w-full">
            {t.whatsapp}
          </BoutonWhatsApp>
        </div>
      ) : !ouvert ? (
        <Button type="button" variante="secondaire" iconeAvant={<PartyPopper size={16} aria-hidden="true" />} onClick={ouvrir}>
          {t.ouvrir}
        </Button>
      ) : (
        <form className="particuliere-formulaire" onSubmit={envoyer} noValidate>
          <fieldset className="particuliere-groupe">
            <legend className="text-sm th-text-1 font-medium mb-2">{t.type}</legend>
            <div className="particuliere-puces">
              {TYPES_PARTICULIERS.map((v) => (
                <label key={v} className={`particuliere-puce${type === v ? ' est-choisie' : ''}`}>
                  <input type="radio" name="type-particuliere" value={v} checked={type === v} onChange={() => setType(v)} />
                  <span>{t.types[v]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="particuliere-deux">
            <Champ label={t.arrivee} type="date" min={aujourdhui()} value={champs.date_debut} onChange={maj('date_debut')} erreur={erreurs.date_debut} />
            <Champ label={t.depart} type="date" min={champs.date_debut || aujourdhui()} value={champs.date_fin} onChange={maj('date_fin')} erreur={erreurs.date_fin} />
          </div>
          <label className="particuliere-coche">
            <input type="checkbox" checked={aConfirmer} onChange={(e) => setAConfirmer(e.target.checked)} />
            <span>{t.aConfirmer}</span>
          </label>

          <div className="particuliere-deux">
            <Champ label={t.personnesSejour} inputMode="numeric" value={champs.personnes_sejour} onChange={maj('personnes_sejour')} erreur={erreurs.personnes_sejour} />
            {avecInvites && (
              <Champ label={t.invites} inputMode="numeric" value={champs.invites} onChange={maj('invites')} erreur={erreurs.invites} />
            )}
          </div>

          <fieldset className="particuliere-groupe">
            <legend className="text-sm th-text-1 font-medium mb-2">{t.besoins}</legend>
            <div className="particuliere-puces">
              {BESOINS_PARTICULIERS.map((b) => (
                <label key={b} className={`particuliere-puce${besoins.includes(b) ? ' est-choisie' : ''}`}>
                  <input type="checkbox" checked={besoins.includes(b)} onChange={() => basculer(b)} />
                  <span>{t.listeBesoins[b]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <Champ label={t.budget} inputMode="numeric" value={champs.budget} onChange={maj('budget')} erreur={erreurs.budget} />
          <ChampZoneTexte label={t.message} aide={t.messageAide} rows={4} value={champs.message} onChange={maj('message')} erreur={erreurs.message} required />

          <Champ label={t.nom} value={champs.nom} onChange={maj('nom')} erreur={erreurs.nom} autoComplete="name" required />
          <div className="particuliere-deux">
            <Champ label={t.telephone} type="tel" inputMode="tel" value={champs.telephone} onChange={maj('telephone')} erreur={erreurs.telephone} autoComplete="tel" />
            <Champ label={t.email} type="email" value={champs.email} onChange={maj('email')} erreur={erreurs.email} autoComplete="email" />
          </div>
          <p className="text-xs th-text-3">{t.contactAide}</p>

          {/* Le champ piège, hors de l'écran : voir la demande de service. */}
          <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
            <label>
              Site web
              <input type="text" tabIndex={-1} autoComplete="off" value={champs.site_web} onChange={maj('site_web')} />
            </label>
          </div>

          {erreur && <p className="text-sm" style={{ color: 'var(--danger)' }} role="alert">{erreur}</p>}

          <div className="particuliere-actions">
            <Button
              type="submit"
              variante="primaire"
              chargement={envoi}
              disabled={!champs.message.trim() || !champs.nom.trim() || (!champs.telephone.trim() && !champs.email.trim())}
            >
              {t.envoyer}
            </Button>
            <Button type="button" variante="discret" onClick={() => setOuvert(false)}>{t.annuler}</Button>
          </div>
        </form>
      )}
    </section>
  )
}
