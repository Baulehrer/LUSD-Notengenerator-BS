import { useEffect, useState } from 'react'

export const THEMES = [
  { id: 'standard', label: 'Standard' },
  { id: 'nacht', label: 'Nachtmodus' },
  { id: 'ozean', label: 'Ozean' },
  { id: 'smaragd', label: 'Smaragd' },
  { id: 'lavendel', label: 'Lavendel' },
  { id: 'bernstein', label: 'Bernstein' },
  { id: 'kontrast', label: 'Hoch-Kontrast' },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

export function useTheme() {
  const [theme, setTheme] = useState<ThemeId>(() => {
    const saved = localStorage.getItem('lusd-theme') as ThemeId | null
    if (saved && THEMES.some(t => t.id === saved)) return saved
    return 'standard'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('lusd-theme', theme)
  }, [theme])

  return { theme, setTheme }
}
