import { beforeAll, describe, expect, test } from 'bun:test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { startServer } from './server'

const TEST_OUTPUT_DIR = join(import.meta.dir, '..', 'Output')

let baseUrl: string
let server: ReturnType<typeof startServer> extends Promise<infer S> ? S : never

describe('Server API', () => {
  beforeAll(async () => {
    mkdirSync(TEST_OUTPUT_DIR, { recursive: true })
    server = await startServer(0)
    baseUrl = `http://localhost:${server.port}`
  })

  describe('GET /api/berufe', () => {
    test('returns array of beruf names', async () => {
      const res = await fetch(`${baseUrl}/api/berufe?q=Kfz`)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBeGreaterThan(0)
    })

    test('returns all berufe when no query', async () => {
      const res = await fetch(`${baseUrl}/api/berufe`)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBeGreaterThan(0)
    })
  })

  describe('GET /api/beruf/:name', () => {
    test('returns beruf object for known name', async () => {
      // First get a list to find a valid name
      const listRes = await fetch(`${baseUrl}/api/berufe?q=Kfz`)
      const list = (await listRes.json()) as string[]
      if (list.length === 0) return // Skip if no data

      const res = await fetch(`${baseUrl}/api/beruf/${encodeURIComponent(list[0]!)}`)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveProperty('name')
      expect(data).toHaveProperty('lernfelder')
    })

    test('returns 404 for unknown beruf', async () => {
      const res = await fetch(`${baseUrl}/api/beruf/NonexistentBeruf12345`)
      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/einstellungen', () => {
    test('returns default settings structure', async () => {
      const res = await fetch(`${baseUrl}/api/einstellungen`)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveProperty('halbjahrStunden')
      expect(data).toHaveProperty('tutorialTipps')
    })
  })

  describe('PUT /api/einstellungen', () => {
    test('merges partial settings', async () => {
      // Get current settings
      const getRes = await fetch(`${baseUrl}/api/einstellungen`)
      const original = await getRes.json()

      // Patch tutorialTipps
      const putRes = await fetch(`${baseUrl}/api/einstellungen`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tutorialTipps: false }),
      })
      expect(putRes.status).toBe(200)

      // Verify it was merged
      const getRes2 = await fetch(`${baseUrl}/api/einstellungen`)
      const updated = await getRes2.json()
      expect(updated.tutorialTipps).toBe(false)
      expect(updated).toHaveProperty('halbjahrStunden')

      // Restore original
      await fetch(`${baseUrl}/api/einstellungen`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tutorialTipps: original.tutorialTipps }),
      })
    })
  })

  describe('Templates CRUD', () => {
    test('GET /api/templates returns store', async () => {
      const res = await fetch(`${baseUrl}/api/templates`)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveProperty('stundenTemplates')
      expect(data).toHaveProperty('komplettVorlagen')
    })

    test('POST and DELETE template roundtrip', async () => {
      // Create a stunden template
      const createRes = await fetch(`${baseUrl}/api/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'stunden',
          name: 'Test Template',
          data: { halbjahrStunden: { '10/2': { D: 40 } } },
        }),
      })
      expect(createRes.status).toBe(200)
      const created = await createRes.json()
      expect(created).toHaveProperty('ok', true)
      expect(created).toHaveProperty('id')

      // Verify it appears in list
      const listRes = await fetch(`${baseUrl}/api/templates`)
      const list = await listRes.json()
      const found = list.stundenTemplates.find((t: { name: string }) => t.name === 'Test Template')
      expect(found).toBeDefined()

      // Delete it
      if (created.id) {
        const delRes = await fetch(`${baseUrl}/api/templates/${created.id}`, {
          method: 'DELETE',
        })
        expect(delRes.status).toBe(200)
      }
    })
  })

  describe('POST /api/pdf', () => {
    test('generates PDF with minimal data', async () => {
      // Get a valid beruf name first
      const listRes = await fetch(`${baseUrl}/api/berufe?q=Kfz`)
      const list = (await listRes.json()) as string[]
      if (list.length === 0) return

      const body = {
        nachname: 'Test',
        vorname: 'Max',
        klasse: '12B',
        berufName: list[0],
        halbjahre: ['11/1', '11/2', '12/1', '12/2'],
        semester: '12/2',
        austritt: '2025-06-30',
        lernfelderNoten: { LF01: 3, LF02: 2 },
        allgFaecherNoten: {
          D: [null, 3, 2, null, null, null],
          POWI: [null, 2, 3, null, null, null],
          RKA: [null, 1, 2, null, null, null],
          SPO: [null, 2, 1, null, null, null],
          ENG: [null, 3, 2, null, null, null],
        },
        halbjahrStunden: {
          '10/2': { D: 40, POWI: 40, RKA: 40, SPO: 40, ENG: 40 },
          '11/1': { D: 20, POWI: 20, RKA: 20, SPO: 20, ENG: 20 },
          '11/2': { D: 20, POWI: 20, RKA: 20, SPO: 20, ENG: 20 },
          '12/1': { D: 20, POWI: 20, RKA: 20, SPO: 20, ENG: 20 },
          '12/2': { D: 20, POWI: 20, RKA: 20, SPO: 20, ENG: 20 },
          '13/1': { D: 20, POWI: 20, RKA: 20, SPO: 20, ENG: 20 },
        },
      }

      const res = await fetch(`${baseUrl}/api/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('application/pdf')

      const buffer = Buffer.from(await res.arrayBuffer())
      expect(buffer.length).toBeGreaterThan(1024)

      const header = buffer.subarray(0, 4).toString('ascii')
      expect(header).toBe('%PDF')
    })

    test('returns 400 for missing beruf', async () => {
      const body = {
        nachname: 'Test',
        vorname: 'Max',
        klasse: '12B',
        berufName: 'NonexistentBeruf99999',
        halbjahre: ['11/1'],
        lernfelderNoten: {},
        allgFaecherNoten: {},
      }

      const res = await fetch(`${baseUrl}/api/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      expect(res.status).toBe(400)
    })
  })
})
