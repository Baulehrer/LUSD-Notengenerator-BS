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
  zeugnisTyp: 'abschluss' | 'abgang'
  onNachnameChange: (v: string) => void
  onVornameChange: (v: string) => void
  onKlasseChange: (v: string) => void
  onAustrittChange: (v: string) => void
  onHalbjahreChange: (n: number) => void
  onBerufSelect: (name: string) => void
  onZeugnisTypChange: (v: 'abschluss' | 'abgang') => void
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
  zeugnisTyp,
  onNachnameChange,
  onVornameChange,
  onKlasseChange,
  onAustrittChange,
  onHalbjahreChange,
  onBerufSelect,
  onZeugnisTypChange,
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
        <label>Zeugnis:</label>
        <div className="zeugnis-toggle">
          <label className={`zeugnis-option${zeugnisTyp === 'abschluss' ? ' active' : ''}`}>
            <input
              type="radio"
              name="zeugnisTyp"
              value="abschluss"
              checked={zeugnisTyp === 'abschluss'}
              onChange={() => onZeugnisTypChange('abschluss')}
            />
            Abschluss
          </label>
          <label className={`zeugnis-option${zeugnisTyp === 'abgang' ? ' active' : ''}`}>
            <input
              type="radio"
              name="zeugnisTyp"
              value="abgang"
              checked={zeugnisTyp === 'abgang'}
              onChange={() => onZeugnisTypChange('abgang')}
            />
            Abgang
          </label>
        </div>
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
