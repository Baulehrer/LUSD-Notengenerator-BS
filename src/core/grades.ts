import type { Schueler, Berechnungsergebnis, Beruf, LernfeldId, AllgemeinesFach, NoteEintrag } from '../types'

const HALBJAHRE_STUNDEN: Record<string, number> = {
  '10/1': 0,
  '10/2': 40,
  '11/1': 20,
  '11/2': 20,
  '12/1': 20,
  '12/2': 20,
  '13/1': 20,
}

const ALLGEMEINE_FAECHER: AllgemeinesFach[] = ['D', 'POWI', 'RKA', 'SPO', 'ENG']
const LERNFELDER: LernfeldId[] = ['LF01', 'LF02', 'LF03', 'LF04', 'LF05', 'LF06', 'LF07', 'LF08', 'LF09', 'LF10', 'LF11', 'LF12', 'LF13', 'LF14', 'LF15', 'LF16', 'LF17', 'LF18']

export function roundNote(note: number): number {
  return Math.round(note * 10) / 10
}

export function roundToWholeNote(note: number): number {
  return Math.round(note)
}

export function parseNote(value: string | null | undefined): number | null {
  if (!value) return null
  const match = value.match(/P-(\d)/)
  if (match && match[1]) {
    const n = parseInt(match[1], 10)
    return n >= 1 && n <= 6 ? n : null
  }
  return null
}

export function calculateBBUNote(schueler: Schueler, beruf: Beruf): { note: number; gewichtung: number; stunden: number } {
  let totalGewichtung = 0
  let totalStunden = 0

  for (const lfId of LERNFELDER) {
    const stunden = beruf.lernfelder.get(lfId) ?? 0
    if (stunden === 0) continue

    const notenListe = schueler.noten.lernfelder.get(lfId) || []
    for (const notenEintrag of notenListe) {
      if (notenEintrag.note !== null && notenEintrag.note > 0) {
        totalGewichtung += notenEintrag.note * stunden
        totalStunden += stunden
      }
    }
  }

  const note = totalStunden > 0 ? totalGewichtung / totalStunden : 0
  return {
    note: roundNote(note),
    gewichtung: totalGewichtung,
    stunden: totalStunden
  }
}

export function calculateAllgemeinesFach(notenListe: NoteEintrag[], halbjahre: string[]): { note: number; gewichtung: number; stunden: number } {
  let totalGewichtung = 0
  let totalStunden = 0

  for (let i = 0; i < notenListe.length && i < halbjahre.length; i++) {
    const halbjahr = halbjahre[i]
    if (!halbjahr) continue
    const stunden = HALBJAHRE_STUNDEN[halbjahr] ?? 0
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
    stunden: totalStunden
  }
}

export function calculateGesamtnote(
  bbuResult: { note: number; gewichtung: number; stunden: number },
  allgFaecherResults: Map<string, { note: number; gewichtung: number; stunden: number }>
): number {
  const totalGewichtung = bbuResult.gewichtung + 
    Array.from(allgFaecherResults.values()).reduce((sum, r) => sum + r.gewichtung, 0)
  const totalStunden = bbuResult.stunden + 
    Array.from(allgFaecherResults.values()).reduce((sum, r) => sum + r.stunden, 0)

  return totalStunden > 0 ? roundNote(totalGewichtung / totalStunden) : 0
}

export function calculateSchuelerNoten(schueler: Schueler, beruf: Beruf, halbjahre: string[]): Berechnungsergebnis {
  const bbuResult = calculateBBUNote(schueler, beruf)
  
  const allgFaecherResults = new Map<string, { note: number; gewichtung: number; stunden: number }>()
  for (const fach of ALLGEMEINE_FAECHER) {
    const notenListe = schueler.noten.allgemeineFaecher.get(fach) || []
    allgFaecherResults.set(fach, calculateAllgemeinesFach(notenListe, halbjahre))
  }

  const gesamtnote = calculateGesamtnote(bbuResult, allgFaecherResults)

  const allgFaecherNoten = new Map<string, { note: number; noteGerundet: number }>()
  for (const [fach, result] of allgFaecherResults) {
    allgFaecherNoten.set(fach, {
      note: result.note,
      noteGerundet: roundToWholeNote(result.note)
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
    gewichtungAllg: Array.from(allgFaecherResults.values()).reduce((sum, r) => sum + r.gewichtung, 0)
  }
}
