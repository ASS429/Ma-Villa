import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  isDark: boolean
  /**
   * Propose un thème pour un espace donné, **sans jamais écraser un choix
   * explicite**.
   *
   * Planche 25 : la console d'administration est sombre par défaut — un poste
   * d'opérateur reste ouvert huit heures. Mais « par défaut » ne veut pas dire
   * « imposé » : quelqu'un qui a touché la bascule a tranché, et son choix
   * vaut partout.
   *
   * Rend une fonction qui rétablit la préférence système, à appeler en
   * quittant l'espace.
   */
  suggererTheme: (souhaite: Theme) => () => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

const CLE = 'theme'

function themeInitial(): Theme {
  const enregistre = localStorage.getItem(CLE)
  if (enregistre === 'light' || enregistre === 'dark') return enregistre

  // Aucun choix explicite : on suit la préférence du système plutôt que
  // d'imposer le thème clair.
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(themeInitial)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    // Colore la barre d'adresse du navigateur mobile.
    const meta = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (meta) meta.content = theme === 'dark' ? '#0C0A08' : '#F7F4EF'
  }, [theme])

  useEffect(() => {
    // Tant que l'utilisateur n'a rien choisi, on suit le système en direct.
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem(CLE)) setTheme(e.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const suggererTheme = (souhaite: Theme) => {
    // Un choix explicite prime, et rien ne se passe.
    if (localStorage.getItem(CLE)) return () => {}

    setTheme(souhaite)

    return () => {
      // Toujours aucun choix explicite en quittant : on revient au système.
      if (!localStorage.getItem(CLE)) {
        setTheme(window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      }
    }
  }

  const toggleTheme = () => {
    setTheme((t) => {
      const suivant = t === 'light' ? 'dark' : 'light'
      localStorage.setItem(CLE, suivant)
      return suivant
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, suggererTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- convention des modules de contexte : le hook vit auprès de son provider
export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
