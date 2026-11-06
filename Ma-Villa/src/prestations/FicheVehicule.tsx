import { useState } from 'react'
import { CalendarClock, CarFront, Check, Clock, Undo2 } from 'lucide-react'
import { useLangue } from '../i18n/langue'
import { TEXTES_PRESTATIONS } from './textes'
import type { Vehicule } from '../types'

/**
 * Le véhicule qu'on propose, tel qu'il est : ses photos (plaques floutées), ce qu'il offre,
 * et les trois règles du chauffeur — horaires, délai, annulation — dites avant la demande
 * plutôt qu'apprises au téléphone.
 */
export default function FicheVehicule({ vehicule }: { vehicule: Vehicule }) {
  const { langue } = useLangue()
  const t = TEXTES_PRESTATIONS[langue].vehicule
  const [choisie, setChoisie] = useState(0)
  const photo = vehicule.photos[choisie] ?? vehicule.photos[0]

  return (
    <article className="panneau fiche-vehicule">
      {photo && (
        <div className="fiche-vehicule-galerie">
          <img
            className="fiche-vehicule-photo"
            src={photo.src}
            alt={photo.alt[langue]}
            width={1280}
            height={960}
            loading="lazy"
            decoding="async"
          />
          {vehicule.photos.length > 1 && (
            <div className="fiche-vehicule-vignettes" role="group" aria-label={t.photos}>
              {vehicule.photos.map((p, i) => (
                <button
                  key={p.src}
                  type="button"
                  className={`fiche-vehicule-vignette${i === choisie ? ' est-active' : ''}`}
                  onClick={() => setChoisie(i)}
                  aria-label={p.alt[langue]}
                  aria-pressed={i === choisie}
                >
                  <img src={p.src} alt="" loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="fiche-vehicule-texte">
        <p className="fiche-vehicule-surtitre"><CarFront size={15} aria-hidden="true" /> {t.surtitre}</p>
        <h3 className="fiche-vehicule-nom">{vehicule.nom}</h3>

        <ul className="fiche-vehicule-atouts">
          {vehicule.atouts[langue].map((a) => (
            <li key={a}><Check size={15} aria-hidden="true" /> {a}</li>
          ))}
        </ul>

        <dl className="fiche-vehicule-regles">
          <div><dt><Clock size={15} aria-hidden="true" /> {t.horaires}</dt><dd>{vehicule.horaires[langue]}</dd></div>
          <div><dt><CalendarClock size={15} aria-hidden="true" /> {t.reservation}</dt><dd>{vehicule.reservation[langue]}</dd></div>
          <div><dt><Undo2 size={15} aria-hidden="true" /> {t.annulation}</dt><dd>{vehicule.annulation[langue]}</dd></div>
        </dl>

        <p className="fiche-vehicule-note">{t.note}</p>
      </div>
    </article>
  )
}
