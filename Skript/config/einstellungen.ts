export interface Einstellungen {
  halbjahrStunden: Record<string, number>
  tutorialTipps: boolean
}

export const DEFAULT_HALBJAHR_STUNDEN: Record<string, number> = {
  '10/2': 40,
  '11/1': 20,
  '11/2': 20,
  '12/1': 20,
  '12/2': 20,
  '13/1': 20,
}

import { join, dirname } from 'path'

const ROOT_DIR = typeof Bun !== 'undefined' && process.execPath !== process.argv[1]
  ? dirname(process.execPath)
  : join(import.meta.dir, '..', '..')
const CONFIG_PATH = join(ROOT_DIR, 'Input', 'einstellungen.json')

export function defaultEinstellungen(): Einstellungen {
  return { halbjahrStunden: { ...DEFAULT_HALBJAHR_STUNDEN }, tutorialTipps: true }
}

export async function ladeEinstellungen(): Promise<Einstellungen> {
  try {
    const file = Bun.file(CONFIG_PATH)
    if (await file.exists()) {
      const data = await file.json()
      return { halbjahrStunden: { ...DEFAULT_HALBJAHR_STUNDEN, ...data.halbjahrStunden }, tutorialTipps: data.tutorialTipps ?? true }
    }
  } catch {
    // fallback to defaults
  }
  return defaultEinstellungen()
}

export async function speichereEinstellungen(e: Einstellungen): Promise<void> {
  await Bun.write(CONFIG_PATH, JSON.stringify(e, null, 2))
}
