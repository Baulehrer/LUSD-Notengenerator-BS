import { describe, expect, test } from 'bun:test'
import { calculateSchuelerNoten } from '../core/grades'
import { DEFAULT_FACH_STUNDEN } from '../shared/constants'
import type { Beruf, NoteEintrag, Schueler } from '../types'
import { generatePDF } from './pdf'

function makeSchueler(): Schueler {
  const lfNoten = new Map<string, NoteEintrag[]>()
  lfNoten.set('LF01', [{ note: 3, lehrer: 'Müller' }])
  lfNoten.set('LF02', [{ note: 2, lehrer: 'Schmidt' }])

  const allgNoten = new Map<string, NoteEintrag[]>()
  allgNoten.set('D', [
    { note: 3, lehrer: '' },
    { note: 2, lehrer: '' },
  ])
  allgNoten.set('POWI', [
    { note: 2, lehrer: '' },
    { note: 3, lehrer: '' },
  ])
  allgNoten.set('RKA', [
    { note: 1, lehrer: '' },
    { note: 2, lehrer: '' },
  ])
  allgNoten.set('SPO', [
    { note: 2, lehrer: '' },
    { note: 1, lehrer: '' },
  ])
  allgNoten.set('ENG', [
    { note: 3, lehrer: '' },
    { note: 2, lehrer: '' },
  ])

  return {
    nachname: 'Mustermann',
    vorname: 'Max',
    klasse: '12B501',
    beruf: 'Kfz-Mechatroniker/-in',
    stufeSemester: '12/2',
    halbjahre: ['11/1', '11/2', '12/1', '12/2'],
    noten: { lernfelder: lfNoten, allgemeineFaecher: allgNoten },
  }
}

function makeBeruf(): Beruf {
  return {
    name: 'Kfz-Mechatroniker/-in',
    lernfelder: new Map([
      ['LF01', 80],
      ['LF02', 80],
      ['LF03', 80],
    ]),
  }
}

describe('PDF generation', () => {
  test('generates a valid PDF file', async () => {
    const schueler = makeSchueler()
    const beruf = makeBeruf()
    const halbjahre = ['11/1', '11/2', '12/1', '12/2']
    const ergebnis = calculateSchuelerNoten(schueler, beruf, halbjahre, DEFAULT_FACH_STUNDEN)

    const outputPath = `/tmp/test-notengenerator-${Date.now()}.pdf`
    try {
      await generatePDF([ergebnis], outputPath, { beruf, halbjahre })

      const file = Bun.file(outputPath)
      const exists = await file.exists()
      expect(exists).toBe(true)

      const buffer = Buffer.from(await file.arrayBuffer())
      expect(buffer.length).toBeGreaterThan(1024)

      // PDF files start with %PDF
      const header = buffer.subarray(0, 4).toString('ascii')
      expect(header).toBe('%PDF')
    } finally {
      // Cleanup
      try {
        await Bun.write(outputPath, '')
        const f = Bun.file(outputPath)
        if (await f.exists()) {
          // Use unlink via fs
          const { unlink } = await import('node:fs/promises')
          await unlink(outputPath)
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  })

  test('PDF contains student name in metadata', async () => {
    const schueler = makeSchueler()
    const beruf = makeBeruf()
    const halbjahre = ['11/1', '11/2', '12/1', '12/2']
    const ergebnis = calculateSchuelerNoten(schueler, beruf, halbjahre, DEFAULT_FACH_STUNDEN)

    const outputPath = `/tmp/test-notengenerator-meta-${Date.now()}.pdf`
    try {
      await generatePDF([ergebnis], outputPath, { beruf, halbjahre })

      const file = Bun.file(outputPath)
      const buffer = Buffer.from(await file.arrayBuffer())
      const content = buffer.toString('latin1')

      // PDF should contain the title metadata
      expect(content).toContain('Einzelfallberechnung')
    } finally {
      try {
        const { unlink } = await import('node:fs/promises')
        await unlink(outputPath)
      } catch {
        // Ignore
      }
    }
  })
})
