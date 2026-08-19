import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Marque from './Marque'

export default function Footer() {
  const { user } = useAuth()
  const dashLink = user?.role === 'admin' ? '/admin' : '/dashboard'

  return (
    <footer className="px-6 md:px-12 lg:px-16 py-12" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-10">
          <div>
            <Marque taille="md" />
            <p className="text-sm th-text-2 mt-2 max-w-xs leading-relaxed">
              Location de villas et logements de vacances au Sénégal.
            </p>
          </div>

          <nav className="flex flex-wrap gap-x-12 gap-y-8 text-sm" aria-label="Pied de page">
            <div className="flex flex-col gap-2.5">
              <p className="font-semibold th-text-1">Explorer</p>
              <Link to="/villas" className="th-text-2 hover:th-text-1 transition-colors">Toutes les villas</Link>
              {user ? (
                <Link to={dashLink} className="th-text-2 hover:th-text-1 transition-colors">Mon espace</Link>
              ) : (
                <>
                  <Link to="/login" className="th-text-2 hover:th-text-1 transition-colors">Connexion</Link>
                  <Link to="/register" className="th-text-2 hover:th-text-1 transition-colors">S'inscrire</Link>
                </>
              )}
            </div>

            <div className="flex flex-col gap-2.5">
              <p className="font-semibold th-text-1">Informations</p>
              <Link to="/conditions-generales" className="th-text-2 hover:th-text-1 transition-colors">Conditions générales</Link>
              <Link to="/confidentialite" className="th-text-2 hover:th-text-1 transition-colors">Confidentialité</Link>
              <Link to="/annulation" className="th-text-2 hover:th-text-1 transition-colors">Politique d'annulation</Link>
              <Link to="/mentions-legales" className="th-text-2 hover:th-text-1 transition-colors">Mentions légales</Link>
            </div>
          </nav>
        </div>

        <p className="text-sm th-text-3 mt-10 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
          © {new Date().getFullYear()} Ma Villa · Sénégal
        </p>
      </div>
    </footer>
  )
}
