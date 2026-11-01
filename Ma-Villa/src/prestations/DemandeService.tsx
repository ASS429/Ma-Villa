import { useState } from 'react'
import { LocateFixed, MapPin, MessageCircle, Phone, Send } from 'lucide-react'
import api from '../services/api'
import { useConfig } from '../context/ConfigContext'
import { erreursParChamp } from '../lib/erreurs'
import { aujourdhui } from '../lib/format'
import { lienAppel, lienWhatsApp } from '../lib/contact'
import { chiffresDuNumero } from '../lib/telephone'
import { useLangue } from '../i18n/langue'
import { Champ, ChampSelection, ChampZoneTexte } from '../components/ui/Champ'
import Button from '../components/ui/Button'
import { dateDuService, lienCarte, type Position } from './format'
import { TEXTES_PRESTATIONS } from './textes'
import type { CataloguePrestations, FamillePrestation, OrigineDemande } from '../types'

interface Champs {
  date_service: string
  heure: string
  personnes: string
  lieu: string
  vol: string
  delegation: string
  nom: string
  telephone: string
  email: string
  message: string
  /** Le champ piège : invisible, rempli seulement par les robots. */
  site_web: string
}

const VIDE: Champs = {
  date_service: '', heure: '', personnes: '1', lieu: '', vol: '', delegation: '',
  nom: '', telephone: '', email: '', message: '', site_web: '',
}

/** Au-delà, le point peut tomber dans la rue d'à côté : on demande l'adresse aussi. */
const PRECISION_SUFFISANTE_M = 200

/** La localisation est-elle seulement possible ici ? Sans elle, pas de bouton. */
const LOCALISATION_POSSIBLE = typeof navigator !== 'undefined' && 'geolocation' in navigator

type EtatLocalisation = 'repos' | 'en_cours' | 'refusee' | 'introuvable'

interface Envoyee {
  reference: string | null
  lien: string
  /** Le serveur n'a pas gardé la demande : WhatsApp reste la seule trace. */
  enregistree: boolean
}

/**
 * Le formulaire de demande de service.
 *
 * ── Deux temps, et pourquoi ──────────────────────────────────────
 * La demande est d'abord **gardée** sur le serveur, puis **envoyée** sur
 * WhatsApp par le visiteur lui-même. Ouvrir WhatsApp tout seul après l'envoi
 * aurait épargné un geste, mais un `window.open` qui suit un `await` est bloqué
 * par les navigateurs, et une navigation ferait quitter la page sans dire ce
 * qui s'est passé. Le second temps est un vrai lien, sur lequel on clique.
 *
 * Si le serveur ne répond pas, la demande part quand même : WhatsApp suffit à
 * prévenir quelqu'un, la trace en base n'est qu'une sécurité. On le dit au
 * visiteur plutôt que de l'arrêter. Seul un refus de validation l'arrête —
 * c'est qu'une information manque pour lui répondre.
 */
export default function DemandeService({
  catalogue,
  prestation,
  onPrestation,
  origine,
  familles: seulement,
  contexte,
}: {
  catalogue: CataloguePrestations
  prestation: string
  onPrestation: (cle: string) => void
  /** La page d'où part la demande, gardée avec elle. */
  origine: OrigineDemande
  /** Limiter le choix à certaines familles — celle de la page, par exemple. */
  familles?: FamillePrestation[]
  /** Ajouté à l'en-tête du message WhatsApp, ex. « JOJ Dakar 2026 ». */
  contexte?: string
}) {
  const { langue } = useLangue()
  const t = TEXTES_PRESTATIONS[langue]
  const { reservations } = useConfig()
  const contact = reservations.contact
  const [champs, setChamps] = useState<Champs>(VIDE)
  const [erreurs, setErreurs] = useState<Record<string, string>>({})
  const [envoi, setEnvoi] = useState(false)
  const [envoyee, setEnvoyee] = useState<Envoyee | null>(null)
  const [position, setPosition] = useState<Position | null>(null)
  const [localisation, setLocalisation] = useState<EtatLocalisation>('repos')

  const familles = (Object.keys(catalogue.familles) as FamillePrestation[])
    .filter((f) => !seulement || seulement.includes(f))
  const proposees = catalogue.catalogue.filter((p) => familles.includes(p.famille))
  const choisie = proposees.find((p) => p.cle === prestation)

  const maj = (champ: keyof Champs) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setChamps((c) => ({ ...c, [champ]: e.target.value }))
      setErreurs((er) => ({ ...er, [champ]: '' }))
    }

  /**
   * « Utiliser ma position actuelle ». Demandée seulement sur ce geste : le
   * navigateur pose alors sa propre question, et un refus n'empêche rien, il
   * reste à écrire l'adresse. Le champ « Où vous trouver » se remplit s'il
   * était vide, pour qu'il reste un texte à lire à côté du point.
   */
  const localiser = () => {
    setLocalisation('en_cours')
    // Une question du navigateur laissée sans réponse ne rappelle jamais la
    // page : sans ce filet, le bouton resterait bloqué sur « Localisation… ».
    const filet = window.setTimeout(() => {
      setLocalisation((etat) => (etat === 'en_cours' ? 'introuvable' : etat))
    }, 20000)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        window.clearTimeout(filet)
        setPosition({
          lat: Number(p.coords.latitude.toFixed(6)),
          lng: Number(p.coords.longitude.toFixed(6)),
          precision: Number.isFinite(p.coords.accuracy) ? Math.round(p.coords.accuracy) : null,
        })
        setLocalisation('repos')
        setChamps((c) => (c.lieu.trim() ? c : { ...c, lieu: t.champs.maPosition }))
        setErreurs((er) => ({ ...er, lieu: '' }))
      },
      (err) => {
        window.clearTimeout(filet)
        setLocalisation(err.code === err.PERMISSION_DENIED ? 'refusee' : 'introuvable')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  }

  const retirerPosition = () => {
    setPosition(null)
    setLocalisation('repos')
    setChamps((c) => (c.lieu === t.champs.maPosition ? { ...c, lieu: '' } : c))
  }

  /**
   * Vérifié ici, dans la langue du visiteur. Le serveur vérifie aussi, mais ses
   * messages sont en français : une famille anglophone ne doit pas buter sur
   * « Ce champ est obligatoire ».
   */
  const verifier = (): Record<string, string> => {
    const e: Record<string, string> = {}
    if (!choisie) e.prestation = t.requis
    for (const champ of ['date_service', 'lieu', 'nom', 'telephone'] as const) {
      if (!champs[champ].trim()) e[champ] = t.requis
    }
    if (!(Number(champs.personnes) >= 1)) e.personnes = t.requis
    // Seules les lettres sont refusées : tous les préfixes passent (70, 71,
    // 75, 76, 77, 78, 33…), écrits avec +221, 00221 ou sans indicatif.
    if (/\p{L}/u.test(champs.telephone)) {
      e.telephone = t.telephoneLettres
    } else if (champs.telephone.trim() && chiffresDuNumero(champs.telephone).length < 8) {
      e.telephone = t.telephoneCourt
    }
    return e
  }

  const messageWhatsApp = (reference: string | null): string => {
    const m = t.message
    const quand = champs.date_service
      ? `${dateDuService(champs.date_service, langue)}${champs.heure ? ` · ${champs.heure}` : ''}`
      : ''
    const lignes: [string, string][] = [
      [m.reference, reference ?? ''],
      [m.service, choisie?.libelle[langue] ?? ''],
      [m.date, quand],
      [m.vol, choisie?.vol ? champs.vol : ''],
      [m.personnes, champs.personnes],
      [m.lieu, champs.lieu],
      [m.position, position ? lienCarte(position) : ''],
      [m.delegation, champs.delegation],
      [m.nom, champs.nom],
      [m.telephone, champs.telephone],
      [m.precisions, champs.message],
    ]

    return [
      contexte ? `${m.entete} (${contexte})` : m.entete,
      '',
      ...lignes.filter(([, v]) => v.trim()).map(([k, v]) => `${k}${m.separateur}${v.trim()}`),
    ].join('\n')
  }

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault()
    const manquants = verifier()
    if (Object.values(manquants).some(Boolean)) {
      setErreurs(manquants)
      return
    }

    setEnvoi(true)
    let reference: string | null = null
    let enregistree = false

    try {
      const { data } = await api.post('/demandes-service', {
        prestation,
        date_service: champs.date_service,
        heure: champs.heure || null,
        personnes: Number(champs.personnes),
        lieu: champs.lieu,
        latitude: position?.lat ?? null,
        longitude: position?.lng ?? null,
        precision_m: position?.precision ?? null,
        vol: choisie?.vol ? champs.vol || null : null,
        delegation: champs.delegation || null,
        nom: champs.nom,
        telephone: champs.telephone,
        email: champs.email || null,
        message: champs.message || null,
        langue,
        origine,
        site_web: champs.site_web,
      })
      reference = data.reference ?? null
      enregistree = true
    } catch (err) {
      // Une information manque : on l'arrête là, au champ concerné.
      const parChamp = erreursParChamp(err)
      if (Object.keys(parChamp).length) {
        setErreurs(parChamp)
        setEnvoi(false)
        return
      }
      // Toute autre panne n'empêche pas de prévenir quelqu'un : l'écran
      // suivant le dit, et WhatsApp porte la demande.
    }

    setEnvoyee({ reference, lien: lienWhatsApp(contact.telephone, messageWhatsApp(reference)), enregistree })
    setEnvoi(false)
  }

  const recommencer = () => {
    setEnvoyee(null)
    setChamps(VIDE)
    setErreurs({})
    setPosition(null)
    setLocalisation('repos')
  }

  if (envoyee) {
    return (
      <section className="panneau" aria-live="polite">
        <h3 className="panneau-titre"><Send size={17} aria-hidden="true" /> {t.derniereEtape}</h3>
        <p className="th-text-2 text-sm leading-relaxed mb-4">
          {t.derniereEtapeTexte(envoyee.reference, contact.nom)}
        </p>
        {!envoyee.enregistree && (
          <p className="console-erreur mb-4" role="status">{t.nonEnregistree}</p>
        )}
        <div className="flex flex-col gap-3">
          <a
            href={envoyee.lien}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primaire btn-md w-full justify-center"
          >
            <MessageCircle size={16} aria-hidden="true" />
            <span>{t.envoyerWhatsApp}</span>
          </a>
          <a href={lienAppel(contact.telephone)} className="btn btn-secondaire btn-sm w-full justify-center">
            <Phone size={15} aria-hidden="true" />
            <span>{t.ouAppeler(contact.telephone)}</span>
          </a>
          <Button variante="discret" taille="sm" onClick={recommencer}>{t.nouvelleDemande}</Button>
        </div>
      </section>
    )
  }

  return (
    <form className="panneau" onSubmit={envoyer} noValidate>
      <div className="achat-champs" style={{ marginTop: 0 }}>
        <ChampSelection
          label={t.champs.prestation}
          value={prestation}
          onChange={(e) => { onPrestation(e.target.value); setErreurs((er) => ({ ...er, prestation: '' })) }}
          erreur={erreurs.prestation}
          required
        >
          <option value="">{t.choisirService}</option>
          {familles.length === 1
            // Une seule famille : un groupe d'options n'aurait qu'un titre à répéter.
            ? proposees.map((p) => <option key={p.cle} value={p.cle}>{p.libelle[langue]}</option>)
            : familles.map((f) => (
              <optgroup key={f} label={catalogue.familles[f]?.[langue] ?? f}>
                {proposees.filter((p) => p.famille === f).map((p) => (
                  <option key={p.cle} value={p.cle}>{p.libelle[langue]}</option>
                ))}
              </optgroup>
            ))}
        </ChampSelection>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Champ
            label={t.champs.date}
            type="date"
            min={aujourdhui()}
            value={champs.date_service}
            onChange={maj('date_service')}
            erreur={erreurs.date_service}
            required
          />
          <Champ
            label={choisie?.vol ? t.champs.heureVol : t.champs.heure}
            type="time"
            value={champs.heure}
            onChange={maj('heure')}
            erreur={erreurs.heure}
          />
          <Champ
            label={t.champs.personnes}
            type="number"
            inputMode="numeric"
            min={1}
            max={50}
            value={champs.personnes}
            onChange={maj('personnes')}
            erreur={erreurs.personnes}
            required
          />
          {choisie?.vol && (
            <Champ
              label={t.champs.vol}
              value={champs.vol}
              onChange={maj('vol')}
              erreur={erreurs.vol}
              maxLength={20}
              autoCapitalize="characters"
            />
          )}
        </div>

        <div className="grid gap-2">
          <Champ
            label={t.champs.lieu}
            aide={t.champs.lieuAide}
            value={champs.lieu}
            onChange={maj('lieu')}
            erreur={erreurs.lieu}
            maxLength={160}
            required
          />
          {LOCALISATION_POSSIBLE && (
            <div className="text-sm grid gap-1" aria-live="polite">
              {position ? (
                <>
                  <p className="th-text-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={14} aria-hidden="true" style={{ color: 'var(--success)' }} />
                      {t.champs.positionAjoutee(position.precision)}
                    </span>
                    <a href={lienCarte(position)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 th-text-1">
                      {t.champs.positionVoir}
                    </a>
                    <button type="button" onClick={retirerPosition} className="underline underline-offset-2 th-text-2">
                      {t.champs.positionRetirer}
                    </button>
                  </p>
                  {position.precision !== null && position.precision > PRECISION_SUFFISANTE_M && (
                    <p className="th-text-3">{t.champs.positionImprecise}</p>
                  )}
                </>
              ) : (
                <div>
                  {/* `type="button"` : dans un formulaire, un bouton sans type l'enverrait.
                      Pas de `chargement` non plus, son « Patientez… » n'existe qu'en français. */}
                  <Button
                    type="button"
                    variante="secondaire"
                    taille="sm"
                    onClick={localiser}
                    disabled={localisation === 'en_cours'}
                    aria-busy={localisation === 'en_cours' || undefined}
                    iconeAvant={<LocateFixed size={15} aria-hidden="true" />}
                  >
                    {localisation === 'en_cours' ? t.champs.positionEnCours : t.champs.positionBouton}
                  </Button>
                </div>
              )}
              {localisation === 'refusee' && <p style={{ color: 'var(--warning)' }}>{t.champs.positionRefusee}</p>}
              {localisation === 'introuvable' && <p style={{ color: 'var(--warning)' }}>{t.champs.positionIntrouvable}</p>}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Champ
            label={t.champs.nom}
            autoComplete="name"
            value={champs.nom}
            onChange={maj('nom')}
            erreur={erreurs.nom}
            maxLength={80}
            required
          />
          <Champ
            label={t.champs.telephone}
            type="tel"
            autoComplete="tel"
            aide={t.champs.telephoneAide}
            value={champs.telephone}
            onChange={maj('telephone')}
            erreur={erreurs.telephone}
            maxLength={30}
            required
          />
          <Champ
            label={t.champs.email}
            type="email"
            autoComplete="email"
            value={champs.email}
            onChange={maj('email')}
            erreur={erreurs.email}
            maxLength={120}
          />
          <Champ
            label={t.champs.delegation}
            value={champs.delegation}
            onChange={maj('delegation')}
            erreur={erreurs.delegation}
            maxLength={80}
          />
        </div>

        <ChampZoneTexte
          label={t.champs.message}
          aide={t.champs.messageAide}
          rows={3}
          value={champs.message}
          onChange={maj('message')}
          erreur={erreurs.message}
          maxLength={1000}
        />

        {/* Le champ piège. Hors de l'écran plutôt que `display: none`, que
            certains robots savent ignorer ; retiré du parcours au clavier et
            des lecteurs d'écran, pour qu'aucun humain ne le remplisse. */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
          <label>
            Site web
            <input type="text" tabIndex={-1} autoComplete="off" value={champs.site_web} onChange={maj('site_web')} />
          </label>
        </div>

        <Button type="submit" variante="primaire" taille="lg" bloc chargement={envoi}>
          {t.envoyer}
        </Button>
      </div>
    </form>
  )
}
