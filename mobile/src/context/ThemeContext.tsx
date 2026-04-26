import { createContext, useContext, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface Colors {
  bg: string
  surface: string
  elevated: string
  input: string
  text1: string
  text2: string
  text3: string
  border: string
  border2: string
  accent: string
  accentWarm: string
  accentGold: string
  accentBg: string
  success: string
  warning: string
  danger: string
  videoOverlay: string
}

const light: Colors = {
  bg:           '#F7F4EF',
  surface:      '#FFFFFF',
  elevated:     '#F0EDE6',
  input:        'rgba(0,0,0,0.04)',
  text1:        '#1A1614',
  text2:        '#6B6560',
  text3:        '#A09890',
  border:       'rgba(0,0,0,0.07)',
  border2:      'rgba(0,0,0,0.14)',
  accent:       '#C4622D',
  accentWarm:   '#E8845A',
  accentGold:   '#D4A843',
  accentBg:     'rgba(196,98,45,0.10)',
  success:      '#22875A',
  warning:      '#D97706',
  danger:       '#DC2626',
  videoOverlay: 'rgba(247,244,239,0.18)',
}

const dark: Colors = {
  bg:           '#0C0A08',
  surface:      '#161210',
  elevated:     '#1E1A17',
  input:        'rgba(255,255,255,0.05)',
  text1:        '#F5F0EB',
  text2:        '#8A837D',
  text3:        '#4A4540',
  border:       'rgba(255,240,220,0.08)',
  border2:      'rgba(255,240,220,0.18)',
  accent:       '#E8845A',
  accentWarm:   '#F0A07A',
  accentGold:   '#E8C060',
  accentBg:     'rgba(232,132,90,0.12)',
  success:      '#34D399',
  warning:      '#FBBF24',
  danger:       '#F87171',
  videoOverlay: 'rgba(0,0,0,0.50)',
}

interface ThemeCtx { colors: Colors; isDark: boolean; toggleTheme: () => void }
const ThemeContext = createContext<ThemeCtx>({ colors: dark, isDark: true, toggleTheme: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    AsyncStorage.getItem('theme').then((v) => { if (v === 'light') setIsDark(false) })
  }, [])

  const toggleTheme = () => {
    setIsDark((prev) => {
      AsyncStorage.setItem('theme', prev ? 'light' : 'dark')
      return !prev
    })
  }

  return (
    <ThemeContext.Provider value={{ colors: isDark ? dark : light, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() { return useContext(ThemeContext) }
