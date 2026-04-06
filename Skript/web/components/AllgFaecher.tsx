import React, { useMemo } from 'react'
import { NoteInput } from './NoteInput'
import { Ergebnis } from './Ergebnis'
import { AUSBILDUNGSJAHRE, FACH_LABELS } from '../lib/constants'
import type { Ergebnis as ErgebnisType } from '../hooks/useSchueler'

interface Props {
  halbjahre: string[]
  alleHalbjahre: string[]
  allgemeineFaecher: readonly string[]
  allgFaecherNoten: Record<string, (number | null)[]>
  halbjahrStunden: Record<string, Record<string, number>>
  onNoteChange: (fach: string, hjIndex: number, note: number | null) => void
  ergebnis: ErgebnisType | null
}

export function AllgFaecher({
  halbjahre, alleHalbjahre, allgemeineFaecher, allgFaecherNoten,
  halbjahrStunden, onNoteChange, ergebnis
}: Props) {
  const activeSet = useMemo(() => new Set(halbjahre), [halbjahre])

  // Calculate per-subject Endnote + Vorschlag
  const fachEndnoten = useMemo(() => {
    const result: Record<string, { endnote: number; vorschlag: number } | null> = {}
    for (const fach of allgemeineFaecher) {
      let totalGew = 0
      let totalStd = 0
      const noten = allgFaecherNoten[fach] || []
      for (let i = 0; i < alleHalbjahre.length; i++) {
        const hj = alleHalbjahre[i]!
        const note = noten[i]
        const stunden = halbjahrStunden[hj]?.[fach] ?? 0
        if (note && note > 0 && stunden > 0 && activeSet.has(hj)) {
          totalGew += note * stunden
          totalStd += stunden
        }
      }
      if (totalStd > 0) {
        const endnote = totalGew / totalStd
        result[fach] = { endnote, vorschlag: Math.round(endnote) }
      } else {
        result[fach] = null
      }
    }
    return result
  }, [allgemeineFaecher, allgFaecherNoten, alleHalbjahre, halbjahrStunden, activeSet])

  return (
    <div className="section">
      <div className="section-header">Allgemeinbildende Fächer</div>
      <div className="section-body">
        <div className="progress-arrow">
          {AUSBILDUNGSJAHRE.map(aj => {
            const isActive = aj.halbjahre.some(h => activeSet.has(h))
            return (
              <div key={aj.label} className={`progress-step ${isActive ? 'active' : ''}`}>
                {aj.label}
              </div>
            )
          })}
          <div className="progress-footer">
            <span className="progress-label">{halbjahre.length} HJ</span>
            <span className="progress-arrow-icon">↓</span>
          </div>
        </div>

        <div className="allg-table-container">
          <table className="allg-table">
            <thead>
              <tr>
                <th>Fach</th>
                {alleHalbjahre.map(hj => (
                  <th key={hj}>{hj}</th>
                ))}
                <th>Endnote</th>
                <th>Vorschlag</th>
              </tr>
            </thead>
            <tbody>
              {allgemeineFaecher.map(fach => {
                const endnote = fachEndnoten[fach]
                return (
                  <tr key={fach}>
                    <td>{FACH_LABELS[fach] || fach}</td>
                    {alleHalbjahre.map((hj, hjIdx) => {
                      const isActive = activeSet.has(hj)
                      return (
                        <td key={hj} className={!isActive ? 'disabled' : ''}>
                          <NoteInput
                            value={allgFaecherNoten[fach]?.[hjIdx] ?? null}
                            onChange={note => onNoteChange(fach, hjIdx, note)}
                            disabled={!isActive}
                          />
                        </td>
                      )
                    })}
                    <td className="endnote-cell">
                      {endnote ? (
                        <span className={`note-${endnote.vorschlag}`}>
                          {endnote.endnote.toFixed(2)}
                        </span>
                      ) : '–'}
                    </td>
                    <td className="vorschlag-cell">
                      {endnote ? (
                        <span className={`note-${endnote.vorschlag}`}>
                          {endnote.vorschlag}
                        </span>
                      ) : '–'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <Ergebnis ergebnis={ergebnis} type="gesamt" />
    </div>
  )
}
