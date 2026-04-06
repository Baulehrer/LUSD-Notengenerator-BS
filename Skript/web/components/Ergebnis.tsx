import type { Ergebnis as ErgebnisType } from '../hooks/useSchueler'

interface Props {
  ergebnis: ErgebnisType | null
  type: 'bbu' | 'gesamt'
}

function floorTwo(x: number): number {
  return Math.floor(x * 100) / 100
}

function formatFormel(ergebnis: ErgebnisType, type: 'bbu' | 'gesamt'): string {
  if (type === 'bbu') {
    const { gewichtungBBU, stundenBBU } = ergebnis
    if (stundenBBU === 0) return ''
    const raw = gewichtungBBU / stundenBBU
    return `Berechnung: (${gewichtungBBU.toFixed(1)} Gew.) / (${stundenBBU} h) = ${raw.toFixed(4)}`
  }
  const { gewichtungBBU, gewichtungAllg, stundenBBU, stundenAllg } = ergebnis
  const totalGew = gewichtungBBU + gewichtungAllg
  const totalStd = stundenBBU + stundenAllg
  if (totalStd === 0) return ''
  const raw = totalGew / totalStd
  return `Berechnung: (${totalGew.toFixed(1)} Gew.) / (${totalStd} h) = ${raw.toFixed(4)}`
}

export function Ergebnis({ ergebnis, type }: Props) {
  if (!ergebnis) {
    return (
      <div className="ergebnis-bar">
        <span className="ergebnis-label">{type === 'bbu' ? 'BBU-Note' : 'Gesamtnote'}: –</span>
      </div>
    )
  }

  // Gesamtnote: auf 2 Nachkommastellen abgerundet (floor), wie im PDF
  const totalStd = ergebnis.stundenBBU + ergebnis.stundenAllg
  const rawGesamt = totalStd > 0 ? (ergebnis.gewichtungBBU + ergebnis.gewichtungAllg) / totalStd : 0
  const note = type === 'bbu' ? ergebnis.bbuNote : floorTwo(rawGesamt)
  const noteGerundet = type === 'bbu' ? ergebnis.bbuNoteGerundet : ergebnis.gesamtnoteGerundet
  const label = type === 'bbu' ? 'BBU-Note' : 'Gesamtnote'
  const formel = formatFormel(ergebnis, type)
  const rundungInfo = type === 'bbu' ? '(ganzzahlig, kaufmännisch gerundet)' : '(2 Nachkommastellen, nur abgerundet)'

  const noteClass = noteGerundet >= 1 && noteGerundet <= 6 ? `note-${noteGerundet}` : ''

  return (
    <div className="ergebnis-bar">
      <span className="ergebnis-label">{label}:</span>
      <span className={`ergebnis-note ${noteClass}`}>{type === 'bbu' ? noteGerundet : note.toFixed(2)}</span>
      {noteGerundet > 0 && <span className="ergebnis-detail">{rundungInfo}</span>}
      {formel && <span className="ergebnis-formel">{formel}</span>}
    </div>
  )
}
