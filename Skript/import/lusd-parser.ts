import * as XLSX from 'xlsx'
import type { Schueler, SchuelerNoten, NoteEintrag, LernfeldId, AllgemeinesFach } from '../types'
import { parseNote } from '../core/grades'

interface ZeugnisRow {
  Schueler_Nachname: string
  Schueler_Vorname: string
  Schueler_Schulform_kurz: string
  Schueler_Beruf: string
  Schueler_StufeSemester: string
}

export function parseZeugnisFile(filePath: string): Map<string, { nachname: string; vorname: string; beruf: string; stufeSemester: string }> {
  const workbook = XLSX.readFile(filePath)
  const sheet = workbook.Sheets['RExcelExport']
  if (!sheet) {
    throw new Error('Sheet RExcelExport nicht gefunden')
  }
  
  const data = XLSX.utils.sheet_to_json<ZeugnisRow>(sheet)
  const result = new Map<string, { nachname: string; vorname: string; beruf: string; stufeSemester: string }>()
  
  for (const row of data) {
    const key = `${row.Schueler_Nachname}_${row.Schueler_Vorname}`
    result.set(key, {
      nachname: row.Schueler_Nachname,
      vorname: row.Schueler_Vorname,
      beruf: row.Schueler_Beruf,
      stufeSemester: row.Schueler_StufeSemester
    })
  }
  
  return result
}

const LERNFELDER_MAP: Record<string, LernfeldId> = {
  'LF01': 'LF01', 'LF02': 'LF02', 'LF03': 'LF03', 'LF04': 'LF04',
  'LF05': 'LF05', 'LF06': 'LF06', 'LF07': 'LF07', 'LF08': 'LF08',
  'LF09': 'LF09', 'LF10': 'LF10', 'LF11': 'LF11', 'LF12': 'LF12',
  'LF13': 'LF13', 'LF14': 'LF14', 'LF15': 'LF15', 'LF16': 'LF16',
  'LF17': 'LF17', 'LF18': 'LF18'
}

const ALLGEMEINE_FAECHER_MAP: Record<string, AllgemeinesFach> = {
  'D': 'D', 'Deutsch': 'D',
  'POWI': 'POWI', 'Politik': 'POWI',
  'RKA': 'RKA', 'Religion': 'RKA',
  'SPO': 'SPO', 'Sport': 'SPO',
  'ENG': 'ENG', 'Englisch': 'ENG'
}

export function parseHistorieFile(filePath: string): Map<string, { noten: SchuelerNoten; klasse: string; halbjahre: string[] }> {
  const workbook = XLSX.readFile(filePath)
  const result = new Map<string, { noten: SchuelerNoten; klasse: string; halbjahre: string[] }>()
  
  for (const sheetName of workbook.SheetNames) {
    if (!sheetName.startsWith('Tabellenblatt')) continue
    
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue
    
    const data = XLSX.utils.sheet_to_json<Record<string, string>>(sheet)
    if (data.length === 0) continue
    
    const halbjahre = extractHalbjahre(data)
    const klasse = extractKlasse(data)
    
    const lernfeldNoten = new Map<LernfeldId, NoteEintrag[]>()
    const allgFachNoten = new Map<AllgemeinesFach, NoteEintrag[]>()
    
    for (const row of data) {
      const fachRaw = row['__EMPTY'] || ''
      const fach = fachRaw.trim()
      
      const lfId = LERNFELDER_MAP[fach]
      if (lfId) {
        const notenListe = extractNotenFromRow(row)
        lernfeldNoten.set(lfId, notenListe)
        continue
      }
      
      const allgFach = ALLGEMEINE_FAECHER_MAP[fach]
      if (allgFach) {
        const notenListe = extractNotenFromRow(row)
        allgFachNoten.set(allgFach, notenListe)
      }
    }
    
    result.set(sheetName, {
      noten: {
        lernfelder: lernfeldNoten,
        allgemeineFaecher: allgFachNoten
      },
      klasse,
      halbjahre
    })
  }
  
  return result
}

function extractHalbjahre(data: Record<string, string>[]): string[] {
  for (const row of data) {
    if (row['__EMPTY']?.trim() !== 'St/Sem') continue
    return Object.keys(row)
      .filter(k => k.startsWith('__EMPTY_'))
      .sort((a, b) => {
        const n = (s: string) => parseInt(s.replace('__EMPTY_', ''), 10)
        return n(a) - n(b)
      })
      .flatMap(k => {
        const v = row[k]?.trim()
        return v && /^\d+\/\d+$/.test(v) ? [v] : []
      })
  }
  return []
}

function extractKlasse(data: Record<string, string>[]): string {
  for (const row of data) {
    const key = row['__EMPTY']
    if (key === 'Klasse') {
      for (const k of Object.keys(row)) {
        if (k.startsWith('__EMPTY_')) {
          const val = row[k]
          if (val && typeof val === 'string' && val.trim()) {
            return val.trim()
          }
        }
      }
    }
  }
  return ''
}

function extractNotenFromRow(row: Record<string, string>): NoteEintrag[] {
  const noten: NoteEintrag[] = []
  
  const keys = Object.keys(row).filter(k => k.startsWith('__EMPTY_') || k === '__EMPTY_1')
    .sort((a, b) => {
      const numA = parseInt(a.replace('__EMPTY_', '').replace('__EMPTY', '1') || '1', 10)
      const numB = parseInt(b.replace('__EMPTY_', '').replace('__EMPTY', '1') || '1', 10)
      return numA - numB
    })
  
  for (const key of keys) {
    const rawValue = row[key]
    if (rawValue && typeof rawValue === 'string') {
      const note = parseNote(rawValue)
      const lehrerMatch = rawValue.match(/P-?\d*\n?(\w+)/)
      const lehrer = lehrerMatch?.[1] ?? ''
      
      noten.push({ note, lehrer })
    } else {
      noten.push({ note: null, lehrer: '' })
    }
  }
  
  return noten
}

export function combineZeugnisAndHistorie(
  zeugnisData: Map<string, { nachname: string; vorname: string; beruf: string; stufeSemester: string }>,
  historieData: Map<string, { noten: SchuelerNoten; klasse: string; halbjahre: string[] }>
): Schueler[] {
  const zList = [...zeugnisData.values()]
  const hList = [...historieData.values()]

  return zList.flatMap((zeugnis, i) => {
    const historie = hList[i]
    if (!historie) return []
    return [{
      nachname: zeugnis.nachname,
      vorname: zeugnis.vorname,
      klasse: historie.klasse,
      beruf: zeugnis.beruf,
      stufeSemester: zeugnis.stufeSemester,
      halbjahre: historie.halbjahre,
      noten: historie.noten
    } satisfies Schueler]
  })
}
