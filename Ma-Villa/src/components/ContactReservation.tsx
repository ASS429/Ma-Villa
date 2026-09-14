import { Phone, MessageCircle, Mail } from 'lucide-react'
import { useConfig } from '../context/ConfigContext'
import { lienAppel, lienCourriel, lienWhatsApp } from '../lib/contact'

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
 */
export default function ContactReservation({
  hebergement,
  compact = false,
}: {
  hebergement?: string
  compact?: boolean
}) {
  const { reservations } = useConfig()
  const { nom, telephone, email } = reservations.contact

  if (compact) {
    return (
      <p className="text-xs th-text-2 leading-relaxed">
        Paiement en ligne momentanément suspendu. Pour finaliser, contactez {nom} au{' '}
        <a href={lienAppel(telephone)} className="th-text-1 font-medium underline underline-offset-2">
          {telephone}
        </a>.
      </p>
    )
  }

  const message = hebergement
    ? `Bonjour, je souhaite réserver « ${hebergement} » vu sur PasseTemps.`
    : 'Bonjour, je souhaite réserver un hébergement vu sur PasseTemps.'
  const objet = hebergement ? `Réservation — ${hebergement}` : 'Réservation PasseTemps'

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="th-text-1 font-medium mb-1">Réservation en ligne bientôt disponible</p>
        <p className="th-text-2 text-sm leading-relaxed">
          En attendant, {nom} prend vos demandes de réservation directement.
        </p>
      </div>

      <a href={lienAppel(telephone)} className="btn btn-primaire btn-md w-full justify-center">
        <Phone size={16} aria-hidden="true" />
        <span>Appeler le {telephone}</span>
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
          <span>E-mail</span>
        </a>
      </div>

      <p className="text-xs th-text-3 text-center break-all">{email}</p>
    </div>
  )
}
