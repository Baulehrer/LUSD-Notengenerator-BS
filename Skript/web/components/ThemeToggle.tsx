import { THEMES, type ThemeId } from '../hooks/useTheme'

interface Props {
  theme: ThemeId
  onSelect: (id: ThemeId) => void
}

export function ThemeToggle({ theme, onSelect }: Props) {
  return (
    <select
      className="theme-select"
      value={theme}
      onChange={e => onSelect(e.target.value as ThemeId)}
      title="Farbschema wählen"
    >
      {THEMES.map(t => (
        <option key={t.id} value={t.id}>{t.label}</option>
      ))}
    </select>
  )
}
