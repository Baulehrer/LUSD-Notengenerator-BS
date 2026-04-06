import { ALLE_HALBJAHRE, ALLGEMEINE_FAECHER, DEFAULT_FACH_STUNDEN, LERNFELDER } from '../shared/constants'
import type { Berechnungsergebnis, Beruf, NoteEintrag, Schueler } from '../types'

// Flat fallback (nur für Standalone-Aufrufe von calculateAllgemeinesFach aus Tests):
// pro Halbjahr der Default-Wert des Fachs "D".
const DEFAULT_FLAT_STUNDEN: Record<string, number> = Object.fromEntries(
  ALLE_HALBJAHRE.map(hj => [hj, DEFAULT_FACH_STUNDEN[hj]?.D ?? 0]),
)

export function roundNote(note: number): number {
  return Math.round(note * 10) / 10
}

export function roundToWholeNote(note: number): number {
  return Math.round(note)
}

export function parseNote(value: string | null | undefined): number | null {
  if (!value) return null
  const match = value.match(/P-(\d)/)
  if (match?.[1]) {
    const n = parseInt(match[1], 10)
    return n >= 1 && n <= 6 ? n : null
  }
  return null
}

export function calculateBBUNote(
  schueler: Schueler,
  beruf: Beruf,
  lfStundenOverrides?: Map<string, number>,
): { note: number; gewichtung: number; stunden: number } {
  let totalGewichtung = 0
  let totalStunden = 0

  for (const lfId of LERNFELDER) {
    const stunden = lfStundenOverrides?.get(lfId) ?? beruf.lernfelder.get(lfId) ?? 0
    if (stunden === 0) continue

    const notenListe = schueler.noten.lernfelder.get(lfId) || []
    const latest = [...notenListe].reverse().find(n => n.note !== null && n.note > 0)
    if (latest) {
      totalGewichtung += latest.note! * stunden
      totalStunden += stunden
    }
  }

  const note = totalStunden > 0 ? totalGewichtung / totalStunden : 0
  return {
    note: roundNote(note),
    gewichtung: totalGewichtung,
    stunden: totalStunden,
  }
}

export function calculateAllgemeinesFach(
  notenListe: NoteEintrag[],
  halbjahre: string[],
  halbjahrStunden?: Record<string, number>,
): { note: number; gewichtung: number; stunden: number } {
  const stundenMap = halbjahrStunden ?? DEFAULT_FLAT_STUNDEN
  let totalGewichtung = 0
  let totalStunden = 0

  for (let i = 0; i < notenListe.length && i < halbjahre.length; i++) {
    const halbjahr = halbjahre[i]
    if (!halbjahr) continue
    const stunden = stundenMap[halbjahr] ?? 0
    const notenEintrag = notenListe[i]

    if (stunden > 0 && notenEintrag?.note !== null && notenEintrag?.note !== undefined && notenEintrag.note > 0) {
      totalGewichtung += notenEintrag.note * stunden
      totalStunden += stunden
    }
  }

  const note = totalStunden > 0 ? totalGewichtung / totalStunden : 0
  return {
    note: roundNote(note),
    gewichtung: totalGewichtung,
    stunden: totalStunden,
  }
}

export function calculateGesamtnote(
  bbuResult: { note: number; gewichtung: number; stunden: number },
  allgFaecherResults: Map<string, { note: number; gewichtung: number; stunden: number }>,
): number {
  const totalGewichtung =
    bbuResult.gewichtung + Array.from(allgFaecherResults.values()).reduce((sum, r) => sum + r.gewichtung, 0)
  const totalStunden =
    bbuResult.stunden + Array.from(allgFaecherResults.values()).reduce((sum, r) => sum + r.stunden, 0)

  return totalStunden > 0 ? roundNote(totalGewichtung / totalStunden) : 0
}

export function calculateSchuelerNoten(
  schueler: Schueler,
  beruf: Beruf,
  halbjahre: string[],
  halbjahrStunden?: Record<string, Record<string, number>>,
  lfStundenOverrides?: Map<string, number>,
): Berechnungsergebnis {
  const bbuResult = calculateBBUNote(schueler, beruf, lfStundenOverrides)
  const stundenMap = halbjahrStunden ?? DEFAULT_FACH_STUNDEN

  const allgFaecherResults = new Map<string, { note: number; gewichtung: number; stunden: number }>()
  for (const fach of ALLGEMEINE_FAECHER) {
    // Extract per-halbjahr stunden for this specific fach
    const fachStd: Record<string, number> = {}
    for (const hj of Object.keys(stundenMap)) {
      fachStd[hj] = stundenMap[hj]?.[fach] ?? 0
    }
    const notenListe = schueler.noten.allgemeineFaecher.get(fach) || []
    allgFaecherResults.set(fach, calculateAllgemeinesFach(notenListe, halbjahre, fachStd))
  }

  const gesamtnote = calculateGesamtnote(bbuResult, allgFaecherResults)

  const allgFaecherNoten = new Map<string, { note: number; noteGerundet: number }>()
  for (const [fach, result] of allgFaecherResults) {
    allgFaecherNoten.set(fach, {
      note: result.note,
      noteGerundet: roundToWholeNote(result.note),
    })
  }

  return {
    schueler,
    bbuNote: bbuResult.note,
    bbuNoteGerundet: roundToWholeNote(bbuResult.note),
    allgemeineFaecherNoten: allgFaecherNoten,
    gesamtnote,
    gesamtnoteGerundet: roundToWholeNote(gesamtnote),
    stundenBBU: bbuResult.stunden,
    stundenAllg: Array.from(allgFaecherResults.values()).reduce((sum, r) => sum + r.stunden, 0),
    gewichtungBBU: bbuResult.gewichtung,
    gewichtungAllg: Array.from(allgFaecherResults.values()).reduce((sum, r) => sum + r.gewichtung, 0),
  }
}
