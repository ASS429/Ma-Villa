import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { ConfigProvider } from './context/ConfigContext.tsx'
import { ThemeProvider } from './context/ThemeContext.tsx'
import { ToastProvider } from './context/ToastContext.tsx'
import { MessagesProvider } from './context/MessagesContext.tsx'
import { enregistrerServiceWorker } from './lib/pwa.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <ConfigProvider>
                {/* Au-dessus de l'application : la navigation basse est globale
                    et porte la pastille. Le fournisseur ne demande rien tant
                    que personne n'est connecté. */}
                <MessagesProvider>
                  <App />
                </MessagesProvider>
              </ConfigProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)

// Enregistré après le premier rendu : le faire avant retarderait l'affichage
// pour installer un cache dont cette visite-ci ne profitera pas. Un échec est
// sans conséquence — l'application fonctionne alors en ligne seulement.
enregistrerServiceWorker()
