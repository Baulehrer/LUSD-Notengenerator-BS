import { fachStunden, DEFAULT_FACH_STUNDEN } from '../shared/constants'
import { CONFIG_PATH } from './paths'

export interface Einstellungen {
  halbjahrStunden: Record<string, Record<string, number>>
  tutorialTipps: boolean
}

export const DEFAULT_HALBJAHR_STUNDEN: Record<string, Record<string, number>> = DEFAULT_FACH_STUNDEN

export function defaultEinstellungen(): Einstellungen {
  return { halbjahrStunden: structuredClone(DEFAULT_HALBJAHR_STUNDEN), tutorialTipps: true }
}

/** Migrate old flat format { '10/2': 40, ... } to per-fach format */
function migrateHalbjahrStunden(raw: unknown): Record<string, Record<string, number>> {
  if (!raw || typeof raw !== 'object') return structuredClone(DEFAULT_HALBJAHR_STUNDEN)
  const obj = raw as Record<string, unknown>
  const result: Record<string, Record<string, number>> = {}
  for (const [hj, val] of Object.entries(obj)) {
    if (typeof val === 'number') {
      // Old flat format — expand to per-fach
      result[hj] = fachStunden(val)
    } else if (typeof val === 'object' && val !== null) {
      result[hj] = val as Record<string, number>
    }
  }
  // Merge with defaults for any missing HJ
  for (const [hj, def] of Object.entries(DEFAULT_HALBJAHR_STUNDEN)) {
    if (!result[hj]) result[hj] = { ...def }
  }
  return result
}

export async function ladeEinstellungen(): Promise<Einstellungen> {
  try {
    const file = Bun.file(CONFIG_PATH)
    if (await file.exists()) {
      const data = await file.json()
      return {
        halbjahrStunden: migrateHalbjahrStunden(data.halbjahrStunden),
        tutorialTipps: data.tutorialTipps ?? true
      }
    }
  } catch {
    // fallback to defaults
  }
  return defaultEinstellungen()
}

export async function speichereEinstellungen(e: Einstellungen): Promise<void> {
  await Bun.write(CONFIG_PATH, JSON.stringify(e, null, 2))
}
