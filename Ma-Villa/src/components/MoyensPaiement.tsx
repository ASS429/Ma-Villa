import { useConfig } from '../context/ConfigContext'
import { useLangue } from '../i18n/langue'
import { TEXTES_HEBERGEMENT } from '../i18n/hebergement'

/**
 * Logos des moyens de paiement — on les reconnaît d'un coup d'œil, là où un
 * nom écrit demande d'être lu. Ce sont eux qui rassurent sur le fait qu'on
 * paiera comme d'habitude.
 *
 * Déclaré hors du composant parent : un composant créé pendant le rendu perd
 * son état à chaque passage.
 */
const LOGOS: Record<string, string> = {
  wave: '/wave.webp',
  orange_money: '/orange-money.webp',
}

function Logos({ moyens }: { moyens: { cle: string; nom: string }[] }) {
  const connus = moyens.filter((m) => LOGOS[m.cle])
  if (connus.length === 0) return null

  return (
    <span className="moyens-logos">
      {connus.map((m) => (
        <img key={m.cle} src={LOGOS[m.cle]} alt={m.nom} width={28} height={28} loading="lazy" />
      ))}
    </span>
  )
}

/**
 * Annonce les moyens de paiement, sans jamais laisser croire qu'un règlement
 * en ligne est possible tant qu'il ne l'est pas : si le serveur renvoie
 * `paiement.actif = false`, le texte dit explicitement à qui l'on règle — le
 * propriétaire, ou PasseTemps sur le circuit des associés (`plateforme`).
 *
 * Le passage à `true` côté API suffit à basculer l'affichage, sans redéployer
 * le front.
 */
export default function MoyensPaiement({ compact = false, plateforme = false }: { compact?: boolean; plateforme?: boolean }) {
  const { paiement } = useConfig()
  const t = TEXTES_HEBERGEMENT[useLangue().langue].paiement
  // « Wave, Orange Money et carte bancaire » : à trois, joindre par « et »
  // donnait « Wave et Orange Money et Carte bancaire ».
  const liste = paiement.moyens.map((m) => t.nomMoyen(m.cle, m.nom))
  const noms = liste.length > 1 ? `${liste.slice(0, -1).join(', ')}${t.et}${liste[liste.length - 1]}` : liste.join('')

  if (paiement.actif) {
    return (
      <p className="text-xs th-text-2 leading-relaxed flex items-center gap-2">
        <Logos moyens={paiement.moyens} />
        {t.securise(noms)}
      </p>
    )
  }

  if (compact) {
    return (
      <p className="text-xs th-text-3 leading-relaxed">
        {t.directCompact(plateforme)}{' '}
        <span className="th-text-2">{t.bientotCompact(noms)}</span>
      </p>
    )
  }

  return (
    <div
      className="rounded-xl px-4 py-3 flex items-start gap-3"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
    >
      <Logos moyens={paiement.moyens} />
      <div className="text-xs leading-relaxed flex-1">
        <p className="th-text-1 font-medium mb-0.5">
          {t.bientotTitre}
        </p>
        <p className="th-text-2">
          {t.bientotTexte(noms, plateforme)}
        </p>
      </div>
    </div>
  )
}
