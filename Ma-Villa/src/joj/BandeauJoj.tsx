import { ButtonLink } from '../components/ui/Button'
import { Link } from 'react-router-dom'
import { cheminEn, useLangue } from '../i18n/langue'
import { useConfig } from '../context/ConfigContext'
import { estVisible, useOuverture } from '../lib/ouverture'
import { CHEMIN_JOJ, jeuxEnCours } from './index'
import { TEXTES_JOJ } from './textes'

/**
 * Le bandeau de l'accueil vers la vitrine des JOJ.
 *
 * Il ne s'affiche que si la vitrine est ouverte (ou en aperçu pour
 * l'administrateur), et se retire seul au lendemain des Jeux : un rappel
 * d'événement passé fait paraître tout le site abandonné.
 */
export default function BandeauJoj() {
  const { joj } = useConfig()
  const ouverture = useOuverture(joj.actif)
  const { langue } = useLangue()
  const t = TEXTES_JOJ[langue].bandeau

  if (!estVisible(ouverture) || !jeuxEnCours()) return null

  return (
    <section className="px-6 md:px-12 lg:px-16 py-8" style={{ borderTop: '1px solid var(--border)' }}>
      <div
        className="max-w-6xl mx-auto rounded-2xl px-6 py-6 md:px-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
        style={{ background: 'var(--accent-bg)', border: '1px solid var(--border)' }}
      >
        <div style={{ minWidth: 0 }}>
          <p className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: 'var(--accent)' }}>
            {t.eyebrow}{ouverture === 'apercu' ? ' · aperçu' : ''}
          </p>
          <p className="th-text-1 font-medium">{t.titre}</p>
          <p className="text-sm th-text-2 leading-relaxed">{t.texte}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 flex-none">
          <ButtonLink to={cheminEn(langue, CHEMIN_JOJ)} variante="primaire" taille="md">{t.bouton}</ButtonLink>
          {langue === 'fr' && (
            // Un lien vers une langue précise : `Link` et non `Lien`, qui le
            // ramènerait à la langue de la page.
            <Link to={cheminEn('en', CHEMIN_JOJ)} hrefLang="en" lang="en" className="text-sm th-text-2 hover:th-text-1 underline underline-offset-2">
              In English
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
