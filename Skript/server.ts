import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { type Einstellungen, ladeEinstellungen, speichereEinstellungen } from './config/einstellungen'
import { DATA_FILE, INPUT_DIR, OUTPUT_DIR, ROOT_DIR } from './config/paths'
import { ladeTemplates, speichereTemplates, type TemplateStore } from './config/templates'
import { calculateSchuelerNoten } from './core/grades'
import { BerufeLoader } from './import/berufe-loader'
import type { Beruf, NoteEintrag, Schueler } from './types'
import index from './web/index.html'

const loader = new BerufeLoader()

async function findSchullogo(): Promise<string | null> {
  const extensions = ['png', 'jpg', 'jpeg', 'svg', 'webp']
  for (const ext of extensions) {
    const logoPath = join(INPUT_DIR, `Schullogo.${ext}`)
    if (existsSync(logoPath)) return logoPath
  }
  return null
}

function jsonReplacer(_key: string, value: unknown) {
  if (value instanceof Map) return Object.fromEntries(value)
  return value
}

function parseSchuelerFromBody(body: Record<string, unknown>): {
  schueler: Schueler
  beruf: Beruf
  halbjahre: string[]
  halbjahrStunden?: Record<string, Record<string, number>>
  lfStundenOverrides?: Map<string, number>
  zeugnisTyp: 'abschluss' | 'abgang'
} {
  const lfNoten = new Map<string, NoteEintrag[]>()
  const rawLf = body.lernfelderNoten as Record<string, number | null> | undefined
  if (rawLf) {
    for (const [lf, note] of Object.entries(rawLf)) {
      lfNoten.set(lf, [{ note: note && note > 0 ? note : null, lehrer: '' }])
    }
  }

  const allgNoten = new Map<string, NoteEintrag[]>()
  const rawAllg = body.allgFaecherNoten as Record<string, (number | null)[]> | undefined
  if (rawAllg) {
    for (const [fach, noten] of Object.entries(rawAllg)) {
      allgNoten.set(
        fach,
        noten.map(n => ({ note: n && n > 0 ? n : null, lehrer: '' })),
      )
    }
  }

  const schueler: Schueler = {
    nachname: (body.nachname as string) || '',
    vorname: (body.vorname as string) || '',
    klasse: (body.klasse as string) || '',
    beruf: (body.berufName as string) || '',
    stufeSemester: (body.semester as string) || '',
    halbjahre: body.halbjahre as string[],
    noten: { lernfelder: lfNoten, allgemeineFaecher: allgNoten },
  }

  const berufName = (body.berufName as string) || ''
  const beruf = loader.getBeruf(berufName)
  if (!beruf) throw new Error(`Beruf "${berufName}" nicht gefunden`)

  const halbjahre = (body.halbjahre as string[]) || []

  const lfOverrides = body.lfStundenOverrides as Record<string, number> | undefined
  const lfStundenOverrides = lfOverrides
    ? new Map(Object.entries(lfOverrides).map(([k, v]) => [k, Number(v)]))
    : undefined

  const zeugnisTyp = body.zeugnisTyp === 'abgang' ? 'abgang' : 'abschluss'

  return {
    schueler,
    beruf,
    halbjahre,
    halbjahrStunden: body.halbjahrStunden as Record<string, Record<string, number>> | undefined,
    lfStundenOverrides,
    zeugnisTyp,
  }
}

export async function startServer(port = 3000) {
  await loader.load(DATA_FILE)

  const server = Bun.serve({
    port,
    routes: {
      '/': index,

      '/api/berufe': {
        GET: req => {
          const url = new URL(req.url)
          const q = url.searchParams.get('q') || ''
          const results = q.length > 0 ? loader.searchBerufe(q) : loader.getAllBerufe()
          return Response.json(results.slice(0, 50))
        },
      },

      '/api/beruf/:name': {
        GET: req => {
          const name = decodeURIComponent(req.params.name)
          const beruf = loader.getBeruf(name)
          if (!beruf) return Response.json({ error: 'Beruf nicht gefunden' }, { status: 404 })
          return new Response(JSON.stringify(beruf, jsonReplacer), {
            headers: { 'Content-Type': 'application/json' },
          })
        },
      },

      '/api/pdf': {
        POST: async req => {
          try {
            const body = (await req.json()) as Record<string, unknown>
            const { schueler, beruf, halbjahre, halbjahrStunden, lfStundenOverrides, zeugnisTyp } =
              parseSchuelerFromBody(body)
            const ergebnis = calculateSchuelerNoten(schueler, beruf, halbjahre, halbjahrStunden, lfStundenOverrides)

            const austritt = (body.austritt as string) || new Date().toISOString().slice(0, 10)
            const parts = [schueler.nachname || 'Unbekannt', schueler.vorname, schueler.klasse, austritt]
              .filter(Boolean)
              .join('_')
            const filename = `${parts}.pdf`
            const outputPath = join(OUTPUT_DIR, filename)

            await Bun.write(join(ROOT_DIR, 'Output', '.gitkeep'), '')
            const { generatePDF } = await import('./export/pdf')
            await generatePDF([ergebnis], outputPath, { beruf, halbjahre, halbjahrStunden, zeugnisTyp })

            const file = Bun.file(outputPath)
            return new Response(file, {
              headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
              },
            })
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e)
            return Response.json({ error: msg }, { status: 400 })
          }
        },
      },

      '/api/einstellungen': {
        GET: async () => {
          const einstellungen = await ladeEinstellungen()
          return Response.json(einstellungen)
        },
        PUT: async req => {
          const patch = (await req.json()) as Partial<Einstellungen>
          const current = await ladeEinstellungen()
          await speichereEinstellungen({ ...current, ...patch })
          return Response.json({ ok: true })
        },
      },

      '/api/templates': {
        GET: async () => {
          const store = await ladeTemplates()
          return Response.json(store)
        },
        POST: async req => {
          const body = (await req.json()) as { type: 'stunden' | 'komplett'; name: string; data: unknown }
          const store = await ladeTemplates()
          const id = Date.now().toString(36)
          if (body.type === 'stunden') {
            store.stundenTemplates.push({
              id,
              name: body.name,
              data: body.data as TemplateStore['stundenTemplates'][0]['data'],
            })
          } else {
            store.komplettVorlagen.push({
              id,
              name: body.name,
              data: body.data as TemplateStore['komplettVorlagen'][0]['data'],
            })
          }
          await speichereTemplates(store)
          return Response.json({ ok: true, id })
        },
      },

      '/api/templates/:id': {
        DELETE: async req => {
          const id = req.params.id
          const store = await ladeTemplates()
          store.stundenTemplates = store.stundenTemplates.filter(t => t.id !== id)
          store.komplettVorlagen = store.komplettVorlagen.filter(t => t.id !== id)
          await speichereTemplates(store)
          return Response.json({ ok: true })
        },
      },

      '/api/logo': {
        GET: async () => {
          const customLogo = await findSchullogo()
          const logoPath = customLogo || join(import.meta.dir, 'assets', 'fbs-logo.png')
          const file = Bun.file(logoPath)
          if (!(await file.exists())) return new Response('Logo not found', { status: 404 })
          return new Response(file)
        },
      },
    },

    development: {
      hmr: true,
      console: true,
    },
  })

  console.log(`\n🌐 LUSD-Notengenerator läuft auf http://localhost:${server.port}\n`)

  // Auto-open browser
  const open = process.platform === 'linux' ? 'xdg-open' : process.platform === 'darwin' ? 'open' : 'start'
  Bun.spawn([open, `http://localhost:${server.port}`], { stdout: 'ignore', stderr: 'ignore' })

  return server
}
