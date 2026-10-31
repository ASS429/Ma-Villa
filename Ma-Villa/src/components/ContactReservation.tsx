import { Phone, MessageCircle, Mail } from 'lucide-react'
import { useConfig } from '../context/ConfigContext'
import { lienAppel, lienCourriel, lienWhatsApp } from '../lib/contact'
import { useLangue } from '../i18n/langue'
import { TEXTES_HEBERGEMENT } from '../i18n/hebergement'

/**
 * Le contact qui remplace la réservation en ligne tant qu'elle est suspendue.
 *
 * Suspendue le 14 septembre 2026 : le compte PayDunya est bloqué par une
 * vérification d'identité. Plutôt qu'un formulaire que le serveur refuserait,
 * la fiche donne un humain à joindre — et le dit en premier, parce qu'un
 * visiteur qui vient de choisir un logement ne lira pas un paragraphe pour
 * trouver un numéro.
 *
 * L'appel d'abord : c'est le geste le plus direct, et le seul qui marche sans
 * rien installer. WhatsApp et le courriel partent **préremplis** avec le nom de
 * l'hébergement — le contact sait tout de suite de quoi on lui parle.
 *
 * Le contact vient de `/api/configuration` : le changer ne demande pas de
 * redéployer le site.
 *
 * `equipe` : depuis le 31 octobre 2026, la réservation en ligne est rouverte,
 * mais les annonces des associés se réservent auprès de ce même contact. Ce
 * n'est ni une panne ni une attente : le texte ne dit donc pas « bientôt ».
 */
export default function ContactReservation({
  hebergement,
  compact = false,
  equipe = false,
}: {
  hebergement?: string
  compact?: boolean
  equipe?: boolean
}) {
  const { reservations } = useConfig()
  const { nom, telephone, email } = reservations.contact
  const t = TEXTES_HEBERGEMENT[useLangue().langue].contact

  if (compact) {
    return (
      <p className="text-xs th-text-2 leading-relaxed">
        {equipe ? t.equipeCompact(nom) : t.suspenduCompact(nom)}{' '}
        <a href={lienAppel(telephone)} className="th-text-1 font-medium underline underline-offset-2">
          {telephone}
        </a>.
      </p>
    )
  }

  const message = t.message(hebergement)
  const objet = t.objet(hebergement)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="th-text-1 font-medium mb-1">{equipe ? t.equipeTitre : t.bientot}</p>
        <p className="th-text-2 text-sm leading-relaxed">
          {equipe ? t.equipeTexte(nom) : t.enAttendant(nom)}
        </p>
      </div>

      <a href={lienAppel(telephone)} className="btn btn-primaire btn-md w-full justify-center">
        <Phone size={16} aria-hidden="true" />
        <span>{t.appeler(telephone)}</span>
      </a>

      <div className="grid grid-cols-2 gap-2">
        <a
          href={lienWhatsApp(telephone, message)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondaire btn-sm justify-center"
        >
          <MessageCircle size={15} aria-hidden="true" />
          <span>WhatsApp</span>
        </a>
        <a href={lienCourriel(email, objet)} className="btn btn-secondaire btn-sm justify-center">
          <Mail size={15} aria-hidden="true" />
          <span>{t.email}</span>
        </a>
      </div>

      <p className="text-xs th-text-3 text-center break-all">{email}</p>
    </div>
  )
}
