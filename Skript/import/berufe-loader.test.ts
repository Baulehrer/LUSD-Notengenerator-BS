import { beforeAll, describe, expect, test } from 'bun:test'
import * as fs from 'node:fs'
import { join } from 'node:path'
import * as XLSX from 'xlsx'
import { BerufeLoader } from './berufe-loader'

const ROOT_DIR = join(import.meta.dir, '..', '..')
const DATA_FILE = join(ROOT_DIR, 'Input', 'BS_Schulformen_Berufe_Lernfelder.xlsx')

describe('BerufeLoader', () => {
  describe('load', () => {
    test('loads existing Excel file successfully', async () => {
      const loader = new BerufeLoader()
      await loader.load(DATA_FILE)
      expect(loader.getAllBerufe().length).toBeGreaterThan(0)
    })

    test('auto-downloads missing file', async () => {
      const tempFile = '/tmp/test_auto_download.xlsx'
      // Remove if exists
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile)
      }

      const loader = new BerufeLoader()
      await loader.load(tempFile)

      // File should now exist
      expect(fs.existsSync(tempFile)).toBe(true)
      expect(loader.getAllBerufe().length).toBeGreaterThan(0)

      // Cleanup
      fs.unlinkSync(tempFile)
    })

    test('throws error for missing sheet', async () => {
      // Create a temp file without the expected sheet
      const tempFile = '/tmp/test_berufe_temp.xlsx'
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet([['Header']])
      XLSX.utils.book_append_sheet(wb, ws, 'WrongSheet')
      XLSX.writeFile(wb, tempFile)

      const loader = new BerufeLoader()
      try {
        await loader.load(tempFile)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect((error as Error).message).toContain('Berufe mit Lernfeldern')
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('with loaded data', () => {
    let loader: BerufeLoader

    beforeAll(async () => {
      loader = new BerufeLoader()
      await loader.load(DATA_FILE)
    })

    describe('getAllBerufe', () => {
      test('returns array of beruf names', () => {
        const berufe = loader.getAllBerufe()
        expect(Array.isArray(berufe)).toBe(true)
        expect(berufe.length).toBeGreaterThan(0)
      })

      test('returns sorted list', () => {
        const berufe = loader.getAllBerufe()
        const sorted = [...berufe].sort()
        expect(berufe).toEqual(sorted)
      })

      test('returns unique values', () => {
        const berufe = loader.getAllBerufe()
        const unique = new Set(berufe)
        expect(berufe.length).toBe(unique.size)
      })
    })

    describe('getBeruf', () => {
      test('returns undefined for non-existent beruf', () => {
        const result = loader.getBeruf('NonExistentBeruf12345')
        expect(result).toBeUndefined()
      })

      test('returns Beruf for exact match (case insensitive)', () => {
        const berufe = loader.getAllBerufe()
        if (berufe.length > 0 && berufe[0]) {
          const firstBeruf = berufe[0]
          const result = loader.getBeruf(firstBeruf)
          expect(result).toBeDefined()
          expect(result!.name).toBe(firstBeruf)
        }
      })

      test('finds beruf with lowercase search', () => {
        const berufe = loader.getAllBerufe()
        if (berufe.length > 0 && berufe[0]) {
          const firstBeruf = berufe[0]
          const result = loader.getBeruf(firstBeruf.toLowerCase())
          expect(result).toBeDefined()
        }
      })

      test('fuzzy matches partial name', () => {
        const berufe = loader.getAllBerufe()
        if (berufe.length > 0 && berufe[0]) {
          // Get first beruf and search for partial match
          const firstBeruf = berufe[0]
          const partial = firstBeruf.substring(0, 5)
          const result = loader.getBeruf(partial)
          // Should find something via fuzzy search
          expect(result).toBeDefined()
        }
      })

      test('returns Beruf with lernfelder Map', () => {
        const berufe = loader.getAllBerufe()
        if (berufe.length > 0 && berufe[0]) {
          const result = loader.getBeruf(berufe[0])
          expect(result!.lernfelder).toBeInstanceOf(Map)
        }
      })

      test('lernfelder contains valid LernfeldIds', () => {
        const berufe = loader.getAllBerufe()
        if (berufe.length > 0 && berufe[0]) {
          const result = loader.getBeruf(berufe[0])
          const lfIds = Array.from(result!.lernfelder.keys())
          for (const id of lfIds) {
            expect(id).toMatch(/^LF\d{2}$/)
          }
        }
      })

      test('lernfelder stunden are positive numbers', () => {
        const berufe = loader.getAllBerufe()
        if (berufe.length > 0 && berufe[0]) {
          const result = loader.getBeruf(berufe[0])
          for (const stunden of result!.lernfelder.values()) {
            expect(typeof stunden).toBe('number')
            expect(stunden).toBeGreaterThanOrEqual(0)
          }
        }
      })
    })

    describe('searchBerufe', () => {
      test('returns empty array for no matches', () => {
        const result = loader.searchBerufe('NonExistentBeruf12345')
        expect(result).toEqual([])
      })

      test('returns matching berufe', () => {
        const berufe = loader.getAllBerufe()
        if (berufe.length > 0 && berufe[0]) {
          const firstBeruf = berufe[0]
          const partial = firstBeruf.substring(0, 3).toLowerCase()
          const result = loader.searchBerufe(partial)
          expect(result.length).toBeGreaterThanOrEqual(1)
        }
      })

      test('is case insensitive', () => {
        const berufe = loader.getAllBerufe()
        if (berufe.length > 0 && berufe[0]) {
          const firstBeruf = berufe[0]
          const result1 = loader.searchBerufe(firstBeruf.toLowerCase())
          const result2 = loader.searchBerufe(firstBeruf.toUpperCase())
          expect(result1).toEqual(result2)
        }
      })
    })
  })
})
