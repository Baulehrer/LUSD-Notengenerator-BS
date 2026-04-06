export interface Einstellungen {
  halbjahrStunden: Record<string, Record<string, number>>
  tutorialTipps: boolean
}

const FAECHER = ['D', 'POWI', 'RKA', 'SPO', 'ENG'] as const

function fachStunden(std: number): Record<string, number> {
  const r: Record<string, number> = {}
  for (const f of FAECHER) r[f] = std
  return r
}

export const DEFAULT_HALBJAHR_STUNDEN: Record<string, Record<string, number>> = {
  '10/2': fachStunden(40),
  '11/1': fachStunden(20),
  '11/2': fachStunden(20),
  '12/1': fachStunden(20),
  '12/2': fachStunden(20),
  '13/1': fachStunden(20),
}

import { CONFIG_PATH } from './paths'

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
