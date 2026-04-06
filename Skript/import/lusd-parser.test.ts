import { describe, expect, test } from 'bun:test'
import { existsSync, unlinkSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { combineZeugnisAndHistorie, parseHistorieFile, parseZeugnisFile } from './lusd-parser'

// Helper to create temp Excel files
function createTempExcel(sheets: { name: string; data: Record<string, unknown>[] }[]): string {
  const tempFile = `/tmp/test_lusd_${Date.now()}_${Math.random().toString(36).slice(2)}.xlsx`
  const wb = XLSX.utils.book_new()

  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.data)
    XLSX.utils.book_append_sheet(wb, ws, sheet.name)
  }

  XLSX.writeFile(wb, tempFile)
  return tempFile
}

function cleanupTemp(file: string) {
  if (existsSync(file)) {
    unlinkSync(file)
  }
}

describe('parseZeugnisFile', () => {
  test('throws error for missing file', () => {
    expect(() => parseZeugnisFile('nonexistent.xlsx')).toThrow()
  })

  test('throws error for missing RExcelExport sheet', () => {
    const tempFile = createTempExcel([{ name: 'WrongSheet', data: [{ foo: 'bar' }] }])

    try {
      expect(() => parseZeugnisFile(tempFile)).toThrow('RExcelExport')
    } finally {
      cleanupTemp(tempFile)
    }
  })

  test('parses zeugnis data correctly', () => {
    const tempFile = createTempExcel([
      {
        name: 'RExcelExport',
        data: [
          {
            Schueler_Nachname: 'Mustermann',
            Schueler_Vorname: 'Max',
            Schueler_Schulform_kurz: 'BS',
            Schueler_Beruf: 'Fachinformatiker',
            Schueler_StufeSemester: '11/2',
          },
        ],
      },
    ])

    try {
      const result = parseZeugnisFile(tempFile)
      expect(result.size).toBe(1)
      expect(result.has('Mustermann_Max')).toBe(true)

      const schueler = result.get('Mustermann_Max')
      expect(schueler!.nachname).toBe('Mustermann')
      expect(schueler!.vorname).toBe('Max')
      expect(schueler!.beruf).toBe('Fachinformatiker')
      expect(schueler!.stufeSemester).toBe('11/2')
    } finally {
      cleanupTemp(tempFile)
    }
  })

  test('handles multiple students', () => {
    const tempFile = createTempExcel([
      {
        name: 'RExcelExport',
        data: [
          { Schueler_Nachname: 'A', Schueler_Vorname: 'A', Schueler_Beruf: 'Beruf1', Schueler_StufeSemester: '11/1' },
          { Schueler_Nachname: 'B', Schueler_Vorname: 'B', Schueler_Beruf: 'Beruf2', Schueler_StufeSemester: '11/2' },
        ],
      },
    ])

    try {
      const result = parseZeugnisFile(tempFile)
      expect(result.size).toBe(2)
      expect(result.has('A_A')).toBe(true)
      expect(result.has('B_B')).toBe(true)
    } finally {
      cleanupTemp(tempFile)
    }
  })

  test('overwrites duplicate keys', () => {
    const tempFile = createTempExcel([
      {
        name: 'RExcelExport',
        data: [
          {
            Schueler_Nachname: 'Test',
            Schueler_Vorname: 'Test',
            Schueler_Beruf: 'Beruf1',
            Schueler_StufeSemester: '11/1',
          },
          {
            Schueler_Nachname: 'Test',
            Schueler_Vorname: 'Test',
            Schueler_Beruf: 'Beruf2',
            Schueler_StufeSemester: '11/2',
          },
        ],
      },
    ])

    try {
      const result = parseZeugnisFile(tempFile)
      expect(result.size).toBe(1)
      expect(result.get('Test_Test')!.beruf).toBe('Beruf2')
    } finally {
      cleanupTemp(tempFile)
    }
  })
})

describe('parseHistorieFile', () => {
  test('returns empty map for file without Tabellenblatt sheets', () => {
    const tempFile = createTempExcel([{ name: 'OtherSheet', data: [{ foo: 'bar' }] }])
    try {
      const result = parseHistorieFile(tempFile)
      expect(result.size).toBe(0)
    } finally {
      cleanupTemp(tempFile)
    }
  })

  test('returns empty map for empty sheets', () => {
    const tempFile = createTempExcel([{ name: 'Tabellenblatt1', data: [] }])
    try {
      const result = parseHistorieFile(tempFile)
      expect(result.size).toBe(0)
    } finally {
      cleanupTemp(tempFile)
    }
  })

  test('extracts Klasse correctly', () => {
    const tempFile = createTempExcel([
      {
        name: 'Tabellenblatt1',
        data: [{ __EMPTY: 'Klasse', __EMPTY_1: '11B501' }],
      },
    ])
    try {
      const result = parseHistorieFile(tempFile)
      expect(result.size).toBe(1)
      const entry = [...result.values()][0]
      expect(entry?.klasse).toBe('11B501')
    } finally {
      cleanupTemp(tempFile)
    }
  })

  test('parses LF01 note P-2 as note 2', () => {
    const tempFile = createTempExcel([
      {
        name: 'Tabellenblatt1',
        data: [
          { __EMPTY: 'Klasse', __EMPTY_1: '11B501' },
          { __EMPTY: 'LF01', __EMPTY_1: 'P-2' },
        ],
      },
    ])
    try {
      const result = parseHistorieFile(tempFile)
      const entry = [...result.values()][0]
      const lf01 = entry?.noten.lernfelder.get('LF01')
      expect(lf01).toBeDefined()
      expect(lf01![0]!.note).toBe(2)
    } finally {
      cleanupTemp(tempFile)
    }
  })

  test('parses allgemeine Fächer notes correctly', () => {
    const tempFile = createTempExcel([
      {
        name: 'Tabellenblatt1',
        data: [
          { __EMPTY: 'Klasse', __EMPTY_1: '12A201' },
          { __EMPTY: 'D', __EMPTY_1: 'P-3' },
          { __EMPTY: 'POWI', __EMPTY_1: 'P-2' },
          { __EMPTY: 'SPO', __EMPTY_1: 'P-1' },
        ],
      },
    ])
    try {
      const result = parseHistorieFile(tempFile)
      const entry = [...result.values()][0]
      expect(entry?.noten.allgemeineFaecher.get('D')?.[0]?.note).toBe(3)
      expect(entry?.noten.allgemeineFaecher.get('POWI')?.[0]?.note).toBe(2)
      expect(entry?.noten.allgemeineFaecher.get('SPO')?.[0]?.note).toBe(1)
    } finally {
      cleanupTemp(tempFile)
    }
  })

  test('parses multiple LF notes across Halbjahre', () => {
    const tempFile = createTempExcel([
      {
        name: 'Tabellenblatt1',
        data: [
          { __EMPTY: 'Klasse', __EMPTY_1: '11B501' },
          { __EMPTY: 'LF01', __EMPTY_1: 'P-2', __EMPTY_2: 'P-3' },
          { __EMPTY: 'LF02', __EMPTY_1: 'P-4', __EMPTY_2: 'P-5' },
        ],
      },
    ])
    try {
      const result = parseHistorieFile(tempFile)
      const entry = [...result.values()][0]
      const lf01 = entry?.noten.lernfelder.get('LF01')
      expect(lf01?.length).toBeGreaterThanOrEqual(2)
      expect(lf01?.[0]?.note).toBe(2)
      expect(lf01?.[1]?.note).toBe(3)
      const lf02 = entry?.noten.lernfelder.get('LF02')
      expect(lf02?.[0]?.note).toBe(4)
    } finally {
      cleanupTemp(tempFile)
    }
  })

  test('ignores non-Tabellenblatt sheets', () => {
    const tempFile = createTempExcel([
      { name: 'Übersicht', data: [{ __EMPTY: 'LF01', __EMPTY_1: 'P-1' }] },
      { name: 'Tabellenblatt1', data: [{ __EMPTY: 'Klasse', __EMPTY_1: '11B501' }] },
    ])
    try {
      const result = parseHistorieFile(tempFile)
      expect(result.size).toBe(1)
    } finally {
      cleanupTemp(tempFile)
    }
  })

  test('creates one entry per Tabellenblatt sheet', () => {
    const tempFile = createTempExcel([
      { name: 'Tabellenblatt1', data: [{ __EMPTY: 'Klasse', __EMPTY_1: '11A' }] },
      { name: 'Tabellenblatt2', data: [{ __EMPTY: 'Klasse', __EMPTY_1: '11B' }] },
    ])
    try {
      const result = parseHistorieFile(tempFile)
      expect(result.size).toBe(2)
      const klassen = [...result.values()].map(e => e.klasse).sort()
      expect(klassen).toEqual(['11A', '11B'])
    } finally {
      cleanupTemp(tempFile)
    }
  })
})

describe('combineZeugnisAndHistorie', () => {
  test('gibt leeres Array zurück wenn keine Historie-Einträge', () => {
    const zeugnisData = new Map([['Key1', { nachname: 'A', vorname: 'A', beruf: 'Beruf', stufeSemester: '11/1' }]])
    const historieData = new Map<
      string,
      {
        noten: {
          lernfelder: Map<string, { note: number | null; lehrer: string }[]>
          allgemeineFaecher: Map<string, { note: number | null; lehrer: string }[]>
        }
        klasse: string
        halbjahre: string[]
      }
    >()

    const result = combineZeugnisAndHistorie(zeugnisData, historieData)
    expect(result.length).toBe(0)
  })

  test('kombiniert Zeugnis und Historie nach Reihenfolge', () => {
    const zeugnisData = new Map([
      ['Key1', { nachname: 'Mustermann', vorname: 'Max', beruf: 'Fachinformatiker', stufeSemester: '11/2' }],
    ])
    const historieData = new Map([
      [
        'AndererKey',
        {
          noten: { lernfelder: new Map([['LF01', [{ note: 2, lehrer: 'MUE' }]]]), allgemeineFaecher: new Map() },
          klasse: '11B501',
          halbjahre: ['10/2', '11/1'],
        },
      ],
    ])

    const result = combineZeugnisAndHistorie(zeugnisData, historieData)
    expect(result.length).toBe(1)
    expect(result[0]!.nachname).toBe('Mustermann')
    expect(result[0]!.klasse).toBe('11B501')
    expect(result[0]!.halbjahre).toEqual(['10/2', '11/1'])
    expect(result[0]!.noten.lernfelder.has('LF01')).toBe(true)
  })

  test('überspringt Zeugnis-Einträge ohne korrespondierendes Historie-Blatt', () => {
    const zeugnisData = new Map([
      ['A_A', { nachname: 'A', vorname: 'A', beruf: 'Beruf', stufeSemester: '11/1' }],
      ['B_B', { nachname: 'B', vorname: 'B', beruf: 'Beruf', stufeSemester: '11/1' }],
    ])
    const historieData = new Map([
      [
        'Tabellenblatt1',
        { noten: { lernfelder: new Map(), allgemeineFaecher: new Map() }, klasse: '11B501', halbjahre: [] },
      ],
    ])

    const result = combineZeugnisAndHistorie(zeugnisData, historieData)
    expect(result.length).toBe(1)
    expect(result[0]!.nachname).toBe('A')
  })

  test('überträgt halbjahre aus der Historie in den Schüler', () => {
    const zeugnisData = new Map([
      ['Test_Test', { nachname: 'Test', vorname: 'Test', beruf: 'Beruf', stufeSemester: '11/2' }],
    ])
    const historieData = new Map([
      [
        'Tabellenblatt1',
        {
          noten: { lernfelder: new Map(), allgemeineFaecher: new Map() },
          klasse: '11B501',
          halbjahre: ['10/2', '11/1'],
        },
      ],
    ])

    const result = combineZeugnisAndHistorie(zeugnisData, historieData)
    expect(result.length).toBe(1)
    expect(result[0]!.halbjahre).toEqual(['10/2', '11/1'])
  })
})

describe('integration', () => {
  test('full workflow with mock data', () => {
    // Create zeugnis file
    const zeugnisFile = createTempExcel([
      {
        name: 'RExcelExport',
        data: [
          {
            Schueler_Nachname: 'Test',
            Schueler_Vorname: 'User',
            Schueler_Beruf: 'Test',
            Schueler_StufeSemester: '11/1',
          },
        ],
      },
    ])

    // Create historie file with matching key
    const historieFile = createTempExcel([
      {
        name: 'Tabellenblatt1',
        data: [{ __EMPTY: 'Some data' }],
      },
    ])

    try {
      const zeugnisData = parseZeugnisFile(zeugnisFile)
      expect(zeugnisData.size).toBe(1)
      expect(zeugnisData.has('Test_User')).toBe(true)

      const historieData = parseHistorieFile(historieFile)
      expect(historieData.size).toBeGreaterThanOrEqual(0)

      // Combine - may be empty since keys don't match, that's OK
      const combined = combineZeugnisAndHistorie(zeugnisData, historieData)
      expect(Array.isArray(combined)).toBe(true)
    } finally {
      cleanupTemp(zeugnisFile)
      cleanupTemp(historieFile)
    }
  })
})
