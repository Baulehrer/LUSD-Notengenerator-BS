import { test, expect, describe } from 'bun:test'
import { roundNote, roundToWholeNote, parseNote, calculateBBUNote, calculateAllgemeinesFach, calculateGesamtnote, calculateSchuelerNoten } from './grades'
import type { Schueler, Beruf, NoteEintrag } from '../types'

describe('roundNote', () => {
  test('rounds to 1 decimal place', () => {
    expect(roundNote(2.34)).toBe(2.3)
    expect(roundNote(2.35)).toBe(2.4)
    expect(roundNote(2.36)).toBe(2.4)
  })

  test('handles integers', () => {
    expect(roundNote(2)).toBe(2)
    expect(roundNote(3)).toBe(3)
  })

  test('handles edge cases', () => {
    expect(roundNote(0)).toBe(0)
    expect(roundNote(1.99)).toBe(2)
    expect(roundNote(6.01)).toBe(6)
  })
})

describe('roundToWholeNote', () => {
  test('rounds to nearest integer', () => {
    expect(roundToWholeNote(2.4)).toBe(2)
    expect(roundToWholeNote(2.5)).toBe(3)
    expect(roundToWholeNote(2.6)).toBe(3)
  })

  test('handles integers', () => {
    expect(roundToWholeNote(2)).toBe(2)
    expect(roundToWholeNote(6)).toBe(6)
  })

  test('handles decimal grades', () => {
    expect(roundToWholeNote(1.23)).toBe(1)
    expect(roundToWholeNote(3.78)).toBe(4)
    expect(roundToWholeNote(5.5)).toBe(6)
  })
})

describe('parseNote', () => {
  test('parses valid P-X format', () => {
    expect(parseNote('P-1')).toBe(1)
    expect(parseNote('P-2')).toBe(2)
    expect(parseNote('P-3')).toBe(3)
    expect(parseNote('P-4')).toBe(4)
    expect(parseNote('P-5')).toBe(5)
    expect(parseNote('P-6')).toBe(6)
  })

  test('returns null for invalid values', () => {
    expect(parseNote(null)).toBeNull()
    expect(parseNote(undefined)).toBeNull()
    expect(parseNote('')).toBeNull()
    expect(parseNote('P-0')).toBeNull()
    expect(parseNote('P-7')).toBeNull()
    expect(parseNote('1')).toBeNull()
    expect(parseNote('P-X')).toBeNull()
  })

  test('handles extended format with teacher code', () => {
    expect(parseNote('P-2\nMUE')).toBe(2)
    expect(parseNote('P-3SCH')).toBe(3)
  })
})

describe('calculateBBUNote', () => {
  const createMockBeruf = (lernfelder: Map<string, number>): Beruf => ({
    name: 'Test Beruf',
    lernfelder
  })

  const createMockSchueler = (lernfelderNoten: Map<string, NoteEintrag[]>): Schueler => ({
    nachname: 'Test',
    vorname: 'Schüler',
    klasse: '11B501',
    beruf: 'Test Beruf',
    stufeSemester: '11/2',
    noten: {
      lernfelder: lernfelderNoten,
      allgemeineFaecher: new Map()
    }
  })

  test('returns 0 for no grades', () => {
    const beruf = createMockBeruf(new Map([['LF01', 40], ['LF02', 40]]))
    const schueler = createMockSchueler(new Map([
      ['LF01', [{ note: null, lehrer: '' }]],
      ['LF02', [{ note: null, lehrer: '' }]]
    ]))

    const result = calculateBBUNote(schueler, beruf)
    expect(result.note).toBe(0)
    expect(result.stunden).toBe(0)
    expect(result.gewichtung).toBe(0)
  })

  test('calculates weighted average correctly', () => {
    const beruf = createMockBeruf(new Map([['LF01', 40], ['LF02', 80]]))
    const schueler = createMockSchueler(new Map([
      ['LF01', [{ note: 2, lehrer: '' }]],
      ['LF02', [{ note: 4, lehrer: '' }]]
    ]))

    // (2 * 40 + 4 * 80) / (40 + 80) = (80 + 320) / 120 = 400 / 120 = 3.33
    const result = calculateBBUNote(schueler, beruf)
    expect(result.note).toBe(3.3)
    expect(result.stunden).toBe(120)
    expect(result.gewichtung).toBe(400)
  })

  test('ignores Lernfelder with 0 hours', () => {
    const beruf = createMockBeruf(new Map([['LF01', 40], ['LF02', 0]]))
    const schueler = createMockSchueler(new Map([
      ['LF01', [{ note: 3, lehrer: '' }]],
      ['LF02', [{ note: 5, lehrer: '' }]]
    ]))

    const result = calculateBBUNote(schueler, beruf)
    expect(result.note).toBe(3)
    expect(result.stunden).toBe(40)
  })

  test('handles multiple grades per Lernfeld', () => {
    const beruf = createMockBeruf(new Map([['LF01', 40]]))
    const schueler = createMockSchueler(new Map([
      ['LF01', [{ note: 2, lehrer: '' }, { note: 4, lehrer: '' }]]
    ]))

    // (2 * 40 + 4 * 40) / 80 = 240 / 80 = 3
    const result = calculateBBUNote(schueler, beruf)
    expect(result.note).toBe(3)
    expect(result.stunden).toBe(80)
  })
})

describe('calculateAllgemeinesFach', () => {
  test('returns 0 for no grades', () => {
    const result = calculateAllgemeinesFach(
      [{ note: null, lehrer: '' }],
      ['10/2']
    )
    expect(result.note).toBe(0)
    expect(result.stunden).toBe(0)
  })

  test('calculates weighted average with halbjahr hours', () => {
    // 10/2 has 40 hours
    const result = calculateAllgemeinesFach(
      [{ note: 3, lehrer: '' }],
      ['10/2']
    )
    expect(result.note).toBe(3)
    expect(result.stunden).toBe(40)
    expect(result.gewichtung).toBe(120)
  })

  test('handles multiple halbjahre', () => {
    // 10/2 = 40h, 11/1 = 20h
    const result = calculateAllgemeinesFach(
      [{ note: 2, lehrer: '' }, { note: 4, lehrer: '' }],
      ['10/2', '11/1']
    )
    // (2 * 40 + 4 * 20) / 60 = 160 / 60 = 2.67
    expect(result.note).toBe(2.7)
    expect(result.stunden).toBe(60)
  })

  test('ignores 10/1 (0 hours)', () => {
    const result = calculateAllgemeinesFach(
      [{ note: 3, lehrer: '' }],
      ['10/1']
    )
    expect(result.stunden).toBe(0)
    expect(result.note).toBe(0)
  })
})

describe('calculateGesamtnote', () => {
  test('calculates combined average', () => {
    const bbuResult = { note: 3, gewichtung: 300, stunden: 100 }
    const allgFaecherResults = new Map([
      ['D', { note: 2, gewichtung: 80, stunden: 40 }]
    ])

    // (300 + 80) / (100 + 40) = 380 / 140 = 2.71
    const result = calculateGesamtnote(bbuResult, allgFaecherResults)
    expect(result).toBe(2.7)
  })

  test('handles multiple allgemeine Faecher', () => {
    const bbuResult = { note: 3, gewichtung: 300, stunden: 100 }
    const allgFaecherResults = new Map([
      ['D', { note: 2, gewichtung: 80, stunden: 40 }],
      ['ENG', { note: 4, gewichtung: 160, stunden: 40 }]
    ])

    // (300 + 80 + 160) / (100 + 40 + 40) = 540 / 180 = 3
    const result = calculateGesamtnote(bbuResult, allgFaecherResults)
    expect(result).toBe(3)
  })

  test('returns 0 when no stunden', () => {
    const bbuResult = { note: 0, gewichtung: 0, stunden: 0 }
    const allgFaecherResults = new Map()

    const result = calculateGesamtnote(bbuResult, allgFaecherResults)
    expect(result).toBe(0)
  })
})

describe('calculateSchuelerNoten', () => {
  const createFullMockSchueler = (): Schueler => ({
    nachname: 'Mustermann',
    vorname: 'Max',
    klasse: '11B501',
    beruf: 'Fachinformatiker',
    stufeSemester: '11/2',
    noten: {
      lernfelder: new Map([
        ['LF01', [{ note: 2, lehrer: 'MUE' }]],
        ['LF02', [{ note: 3, lehrer: 'SCH' }]]
      ]),
      allgemeineFaecher: new Map([
        ['D', [{ note: 2, lehrer: '' }]],
        ['ENG', [{ note: 3, lehrer: '' }]],
        ['POWI', [{ note: null, lehrer: '' }]],
        ['RKA', [{ note: null, lehrer: '' }]],
        ['SPO', [{ note: null, lehrer: '' }]]
      ])
    }
  })

  const createFullMockBeruf = (): Beruf => ({
    name: 'Fachinformatiker',
    lernfelder: new Map([
      ['LF01', 40],
      ['LF02', 80]
    ])
  })

  test('calculates complete result', () => {
    const schueler = createFullMockSchueler()
    const beruf = createFullMockBeruf()
    const halbjahre = ['10/2']

    const result = calculateSchuelerNoten(schueler, beruf, halbjahre)

    expect(result.schueler).toBe(schueler)
    expect(result.bbuNote).toBeGreaterThan(0)
    expect(result.bbuNoteGerundet).toBeGreaterThanOrEqual(1)
    expect(result.bbuNoteGerundet).toBeLessThanOrEqual(6)
    expect(result.gesamtnote).toBeGreaterThan(0)
    expect(result.stundenBBU).toBe(120)
    expect(result.stundenAllg).toBe(80) // 2 faecher * 40 hours
  })

  test('rounds notes correctly', () => {
    const schueler = createFullMockSchueler()
    const beruf = createFullMockBeruf()
    const halbjahre = ['10/2']

    const result = calculateSchuelerNoten(schueler, beruf, halbjahre)

    // Verify rounded values are integers
    expect(Number.isInteger(result.bbuNoteGerundet)).toBe(true)
    expect(Number.isInteger(result.gesamtnoteGerundet)).toBe(true)
  })

  test('includes all allgemeine Faecher in result', () => {
    const schueler = createFullMockSchueler()
    const beruf = createFullMockBeruf()
    const halbjahre = ['10/2']

    const result = calculateSchuelerNoten(schueler, beruf, halbjahre)

    expect(result.allgemeineFaecherNoten.has('D')).toBe(true)
    expect(result.allgemeineFaecherNoten.has('POWI')).toBe(true)
    expect(result.allgemeineFaecherNoten.has('RKA')).toBe(true)
    expect(result.allgemeineFaecherNoten.has('SPO')).toBe(true)
    expect(result.allgemeineFaecherNoten.has('ENG')).toBe(true)
  })
})
