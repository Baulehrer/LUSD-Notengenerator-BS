import pkg from '../../package.json' with { type: 'json' }
import type { ThemeId } from '../hooks/useTheme'
import { BerufSearch } from './BerufSearch'
import { ThemeToggle } from './ThemeToggle'

interface Props {
  nachname: string
  vorname: string
  klasse: string
  austritt: string
  anzahlHalbjahre: number
  berufName: string
  berufLoading?: boolean
  onNachnameChange: (v: string) => void
  onVornameChange: (v: string) => void
  onKlasseChange: (v: string) => void
  onAustrittChange: (v: string) => void
  onHalbjahreChange: (n: number) => void
  onBerufSelect: (name: string) => void
  theme: ThemeId
  onThemeSelect: (id: ThemeId) => void
}

export function Header({
  nachname,
  vorname,
  klasse,
  austritt,
  anzahlHalbjahre,
  berufName,
  berufLoading,
  onNachnameChange,
  onVornameChange,
  onKlasseChange,
  onAustrittChange,
  onHalbjahreChange,
  onBerufSelect,
  theme,
  onThemeSelect,
}: Props) {
  return (
    <header className="header">
      <div className="header-left">
        <label>Name:</label>
        <input type="text" value={nachname} onChange={e => onNachnameChange(e.target.value)} placeholder="Nachname" />
        <label>Vorname:</label>
        <input type="text" value={vorname} onChange={e => onVornameChange(e.target.value)} placeholder="Vorname" />
        <label>Klasse:</label>
        <input type="text" value={klasse} onChange={e => onKlasseChange(e.target.value)} placeholder="z.B. 12B501" />
        <label>Beruf:</label>
        <div className="beruf-search-wrapper">
          <BerufSearch value={berufName} onSelect={onBerufSelect} />
          {berufLoading && <span className="spinner" />}
        </div>
        <label>Austritt:</label>
        <input type="date" value={austritt} onChange={e => onAustrittChange(e.target.value)} />
        <label>Halbjahre:</label>
        <select value={anzahlHalbjahre} onChange={e => onHalbjahreChange(parseInt(e.target.value, 10))}>
          {[1, 2, 3, 4, 5, 6, 7].map(n => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div className="header-center">
        <h1>LUSD-Notengenerator</h1>
        <div className="subtitle">v{pkg.version} &mdash; S. Kaufmann</div>
      </div>

      <div className="header-right">
        <ThemeToggle theme={theme} onSelect={onThemeSelect} />
        <img
          src="/api/logo"
          alt="Schullogo"
          className="school-logo"
          onError={e => {
            ;(e.target as HTMLImageElement).style.display = 'none'
          }}
        />
      </div>
    </header>
  )
}
