import { Link } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import Seo from '../../components/Seo'
import Footer from '../../components/Footer'
import { DOCUMENTS, TEXTES_PROVISOIRES, type DocumentLegal } from './contenu'

const CHEMINS: Record<DocumentLegal['cle'], string> = {
  cgu: '/conditions-generales',
  confidentialite: '/confidentialite',
  annulation: '/annulation',
  mentions: '/mentions-legales',
}

export default function PageLegale({ document }: { document: DocumentLegal['cle'] }) {
  const doc = DOCUMENTS[document]
  const autres = (Object.keys(DOCUMENTS) as DocumentLegal['cle'][]).filter((c) => c !== document)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-1)' }}>
      <Seo titre={doc.titre} description={doc.description} chemin={CHEMINS[doc.cle]} />
      <PageHeader />

      <article className="max-w-3xl mx-auto px-6 py-12 md:py-16">
        <h1
          className="text-3xl md:text-4xl font-normal th-text-1 mb-3"
          style={{ letterSpacing: '-0.02em', fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          {doc.titre}
        </h1>
        <p className="text-sm th-text-3 mb-8">Dernière mise à jour : {doc.miseAJour}</p>

        {TEXTES_PROVISOIRES && (
          <div
            className="rounded-xl px-5 py-4 mb-10 flex items-start gap-3"
            style={{
              background: 'var(--accent-bg)',
              border: '1px solid var(--border-2)',
            }}
            role="note"
          >
            <svg
              className="w-4 h-4 shrink-0 mt-0.5"
              style={{ color: 'var(--accent)' }}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16.5v.01" strokeLinecap="round" />
            </svg>
            <p className="text-sm th-text-2 leading-relaxed">
              <span className="th-text-1 font-medium">Document en cours de validation.</span>{' '}
              Ce texte est une version de travail, actuellement relue par notre conseil
              juridique. Les mentions entre crochets seront complétées avant sa version
              définitive. Pour toute question dans l'intervalle, contactez-nous.
            </p>
          </div>
        )}

        <p className="th-text-2 leading-relaxed mb-12 text-[0.95rem]">{doc.chapeau}</p>

        <div className="flex flex-col gap-10">
          {doc.sections.map((section) => (
            <section key={section.titre}>
              <h2 className="text-lg font-semibold th-text-1 mb-3">{section.titre}</h2>

              {section.paragraphes.map((p, i) => (
                <p key={i} className="th-text-2 leading-relaxed mb-3 text-[0.95rem]">{p}</p>
              ))}

              {section.liste && (
                <ul className="flex flex-col gap-2 mt-2">
                  {section.liste.map((item, i) => (
                    <li key={i} className="th-text-2 leading-relaxed text-[0.95rem] flex gap-3">
                      <span aria-hidden="true" style={{ color: 'var(--accent)' }}>—</span>
                      <span className="flex-1">{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <nav
          className="mt-16 pt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm"
          style={{ borderTop: '1px solid var(--border)' }}
          aria-label="Autres documents légaux"
        >
          {autres.map((cle) => (
            <Link key={cle} to={CHEMINS[cle]} className="th-text-2 hover:th-text-1 transition-colors">
              {DOCUMENTS[cle].titre}
            </Link>
          ))}
        </nav>
      </article>

      <Footer />
    </div>
  )
}
