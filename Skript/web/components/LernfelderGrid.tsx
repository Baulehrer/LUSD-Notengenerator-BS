import React, { useMemo } from 'react'
import { NoteInput } from './NoteInput'
import { Ergebnis } from './Ergebnis'
import { AUSBILDUNGSJAHRE } from '../lib/constants'
import type { BerufData, Ergebnis as ErgebnisType } from '../hooks/useSchueler'

interface Props {
  berufData: BerufData | null
  relevanteLernfelder: { lf: string; stunden: number }[]
  lernfelderNoten: Record<string, number | null>
  halbjahre: string[]
  onNoteChange: (lf: string, note: number | null) => void
  ergebnis: ErgebnisType | null
}

const BLOCK_GRENZEN = [
  { label: '1. Ausbildungsjahr', shortLabel: '1. AJ', maxCumulative: 320 },
  { label: '2. Ausbildungsjahr', shortLabel: '2. AJ', maxCumulative: 600 },
  { label: '3. Ausbildungsjahr', shortLabel: '3. AJ', maxCumulative: 880 },
]

interface LfBlock {
  label: string
  lernfelder: { lf: string; stunden: number; relevant: boolean }[]
}

function formatLfName(lf: string): string {
  const num = parseInt(lf.replace('LF', ''), 10)
  return `LF ${num}`
}

export function LernfelderGrid({ berufData, relevanteLernfelder, lernfelderNoten, halbjahre, onNoteChange, ergebnis }: Props) {
  const allLernfelder = [
    'LF01','LF02','LF03','LF04','LF05','LF06',
    'LF07','LF08','LF09','LF10','LF11','LF12',
    'LF13','LF14','LF15','LF16','LF17','LF18'
  ]

  const relevantSet = useMemo(
    () => new Set(relevanteLernfelder.map(r => r.lf)),
    [relevanteLernfelder]
  )

  const blocks = useMemo((): LfBlock[] => {
    if (!berufData) return []

    const result: LfBlock[] = []
    let cumulative = 0
    let blockIdx = 0
    let currentBlock: LfBlock = { label: BLOCK_GRENZEN[0]?.label || '', lernfelder: [] }

    for (const lf of allLernfelder) {
      const stunden = berufData.lernfelder[lf] ?? 0
      if (stunden === 0) continue

      cumulative += stunden

      while (blockIdx < BLOCK_GRENZEN.length - 1 && cumulative > (BLOCK_GRENZEN[blockIdx]?.maxCumulative ?? Infinity)) {
        if (currentBlock.lernfelder.length > 0) {
          result.push(currentBlock)
        }
        blockIdx++
        currentBlock = { label: BLOCK_GRENZEN[blockIdx]?.label || '', lernfelder: [] }
      }

      currentBlock.lernfelder.push({
        lf,
        stunden,
        relevant: relevantSet.has(lf)
      })
    }

    if (currentBlock.lernfelder.length > 0) {
      result.push(currentBlock)
    }

    return result
  }, [berufData, relevantSet])

  const activeHalbjahreSet = new Set(halbjahre)

  if (!berufData) {
    return (
      <div className="section">
        <div className="section-header">Berufsbezogener Unterricht (BBU)</div>
        <div className="ergebnis-bar">
          <span className="ergebnis-label">Bitte einen Beruf auswählen, um die Lernfelder zu sehen.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="section">
      <div className="section-header">Berufsbezogener Unterricht (BBU)</div>
      <div className="section-body">
        <div className="progress-arrow">
          {AUSBILDUNGSJAHRE.map(aj => {
            const isActive = aj.halbjahre.some(h => activeHalbjahreSet.has(h))
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

        <div className="lf-grid-container">
          {blocks.map(block => (
            <div key={block.label} className="lf-block">
              <div className="lf-block-label">{block.label}</div>
              <div className="lf-grid">
                {block.lernfelder.map(({ lf, stunden, relevant }) => (
                  <div key={lf} className={`lf-card ${!relevant ? 'disabled' : ''}`}>
                    <div className="lf-card-name">{formatLfName(lf)}</div>
                    <div className="lf-card-stunden">{stunden} Std</div>
                    <NoteInput
                      value={lernfelderNoten[lf] ?? null}
                      onChange={note => onNoteChange(lf, note)}
                      disabled={!relevant}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Ergebnis ergebnis={ergebnis} type="bbu" />
    </div>
  )
}
