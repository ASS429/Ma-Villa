import type { ReactNode } from 'react'
import { Phone, Mail } from 'lucide-react'
import { useConfig } from '../context/ConfigContext'
import { lienAppel, lienCourriel, lienWhatsApp } from '../lib/contact'
import { detailsDeLaReservation, type DetailsDemande, type ReservationDemandee } from '../lib/demande'
import { useLangue } from '../i18n/langue'
import { TEXTES_HEBERGEMENT } from '../i18n/hebergement'
import BoutonWhatsApp from './BoutonWhatsApp'

/**
 * Le contact qui remplace la réservation en ligne tant qu'elle est suspendue.
 *
 * Suspendue le 14 septembre 2026 : le compte PayDunya est bloqué par une
 * vérification d'identité. Plutôt qu'un formulaire que le serveur refuserait,
 * la fiche donne un humain à joindre — et le dit en premier, parce qu'un
 * visiteur qui vient de choisir un logement ne lira pas un paragraphe pour
 * trouver un numéro.
 *
 * WhatsApp d'abord, décision du 2 novembre 2026 : le message part **prérempli**
 * avec tout ce qu'on sait — au moins l'hébergement, jusqu'aux dates et au total
 * si le visiteur les a donnés. Le contact sait tout de suite de quoi on lui
 * parle. L'appel et le courriel restent en retrait.
 *
 * Le contact vient de `/api/configuration` : le changer ne demande pas de
 * redéployer le site.
 *
 * `equipe` : depuis le 31 octobre 2026, la réservation en ligne est rouverte,
 * mais les annonces des associés se réservent auprès de ce même contact. Ni dans
 * ce cas ni quand tout est suspendu le texte ne dit « bientôt » : depuis le
 * 2 novembre 2026, il dit ce qui marche aujourd'hui.
 *
 * `children` : ce que l'écran peut demander de plus, ici les dates de la fiche.
 */
export default function ContactReservation({
  details,
  reservation,
  compact = false,
  equipe = false,
  children,
}: {
  details?: DetailsDemande
  /** Une réservation existante : ses détails tiennent lieu de `details`. */
  reservation?: ReservationDemandee
  compact?: boolean
  equipe?: boolean
  children?: ReactNode
}) {
  const { reservations } = useConfig()
  const { nom, telephone, email } = reservations.contact
  const { langue } = useLangue()
  const t = TEXTES_HEBERGEMENT[langue].contact

  const demande = reservation ? detailsDeLaReservation(reservation, langue) : (details ?? {})
  const whatsapp = lienWhatsApp(telephone, t.message(demande))
  const libelle = reservation ? t.finaliserWhatsApp : t.reserverWhatsApp

  if (compact) {
    return (
      <div className="flex flex-col gap-2 w-full">
        <p className="text-xs th-text-2 leading-relaxed">
          {equipe ? t.equipeCompact(nom) : t.suspenduCompact(nom)}{' '}
          <a href={lienAppel(telephone)} className="th-text-1 font-medium underline underline-offset-2">
            {telephone}
          </a>.
        </p>
        <BoutonWhatsApp href={whatsapp} taille="sm" className="w-full">{libelle}</BoutonWhatsApp>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="th-text-1 font-medium mb-1">{t.equipeTitre}</p>
        <p className="th-text-2 text-sm leading-relaxed">
          {equipe ? t.equipeTexte(nom) : t.equipeDemandes}
        </p>
      </div>

      {children}

      <BoutonWhatsApp href={whatsapp} className="w-full">{libelle}</BoutonWhatsApp>

      <div className="grid grid-cols-2 gap-2">
        <a href={lienAppel(telephone)} className="btn btn-secondaire btn-sm justify-center">
          <Phone size={15} aria-hidden="true" />
          <span>{t.appeler}</span>
        </a>
        <a href={lienCourriel(email, t.objet(demande.hebergement))} className="btn btn-secondaire btn-sm justify-center">
          <Mail size={15} aria-hidden="true" />
          <span>{t.email}</span>
        </a>
      </div>

      <p className="text-xs th-text-3 text-center break-all">
        {telephone}<br />{email}
      </p>
    </div>
  )
}
