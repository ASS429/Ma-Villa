import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useConfig } from '../context/ConfigContext'
import { estVisible, useOuverture } from '../lib/ouverture'
import { useLiensServices } from '../prestations/useLiensServices'
import { CHEMIN_JOJ } from '../joj'
import { useLangue } from '../i18n/langue'
import { COMMUN } from '../i18n/commun'
import Marque from './Marque'

export default function Footer() {
  const { user } = useAuth()
  const { joj } = useConfig()
  const dashLink = user?.role === 'admin' ? '/admin' : '/dashboard'
  const { langue, lien } = useLangue()
  const t = COMMUN[langue].pied
  const nav = COMMUN[langue].nav
  // Un lien n'apparaît que si sa page existe pour la personne qui regarde.
  const services = useLiensServices()
  const vitrineJoj = estVisible(useOuverture(joj.actif))

  return (
    <footer className="px-6 md:px-12 lg:px-16 py-12" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-10">
          <div>
            <Marque taille="md" />
            <p className="text-sm th-text-2 mt-2 max-w-xs leading-relaxed">
              {t.accroche}
            </p>
          </div>

          <nav className="flex flex-wrap gap-x-12 gap-y-8 text-sm" aria-label={t.region}>
            <div className="flex flex-col gap-2.5">
              <p className="font-semibold th-text-1">{t.explorer}</p>
              <Link to={lien('/hebergements/')} className="th-text-2 hover:th-text-1 transition-colors">{t.tousLesHebergements}</Link>
              {services.map((l) => (
                <Link key={l.cle} to={l.to} className="th-text-2 hover:th-text-1 transition-colors">{l.label}</Link>
              ))}
              {vitrineJoj && <Link to={lien(CHEMIN_JOJ)} className="th-text-2 hover:th-text-1 transition-colors">JOJ Dakar 2026</Link>}
              {user ? (
                <Link to={dashLink} className="th-text-2 hover:th-text-1 transition-colors">{nav.monEspace}</Link>
              ) : (
                <>
                  <Link to={lien('/login')} className="th-text-2 hover:th-text-1 transition-colors">{nav.connexion}</Link>
                  <Link to={lien('/register')} className="th-text-2 hover:th-text-1 transition-colors">{nav.inscrire}</Link>
                </>
              )}
            </div>

            <div className="flex flex-col gap-2.5">
              <p className="font-semibold th-text-1">{t.informations}</p>
              <Link to={lien('/conditions-generales/')} className="th-text-2 hover:th-text-1 transition-colors">{t.cgu}</Link>
              <Link to={lien('/confidentialite/')} className="th-text-2 hover:th-text-1 transition-colors">{t.confidentialite}</Link>
              <Link to={lien('/annulation/')} className="th-text-2 hover:th-text-1 transition-colors">{t.annulation}</Link>
              <Link to={lien('/conditions-vente/')} className="th-text-2 hover:th-text-1 transition-colors">{t.vente}</Link>
              <Link to={lien('/mentions-legales/')} className="th-text-2 hover:th-text-1 transition-colors">{t.mentions}</Link>
            </div>
          </nav>
        </div>

        <p className="text-sm th-text-3 mt-10 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
          © {new Date().getFullYear()} PasseTemps · {t.pays}
        </p>
      </div>
    </footer>
  )
}
