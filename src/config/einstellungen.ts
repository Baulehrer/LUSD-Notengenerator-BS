export interface Einstellungen {
  halbjahrStunden: Record<string, number>
}

export const DEFAULT_HALBJAHR_STUNDEN: Record<string, number> = {
  '10/2': 40,
  '11/1': 20,
  '11/2': 20,
  '12/1': 20,
  '12/2': 20,
  '13/1': 20,
}

const CONFIG_PATH = 'data/einstellungen.json'

export function defaultEinstellungen(): Einstellungen {
  return { halbjahrStunden: { ...DEFAULT_HALBJAHR_STUNDEN } }
}

export async function ladeEinstellungen(): Promise<Einstellungen> {
  try {
    const file = Bun.file(CONFIG_PATH)
    if (await file.exists()) {
      const data = await file.json()
      return { halbjahrStunden: { ...DEFAULT_HALBJAHR_STUNDEN, ...data.halbjahrStunden } }
    }
  } catch {
    // fallback to defaults
  }
  return defaultEinstellungen()
}

export async function speichereEinstellungen(e: Einstellungen): Promise<void> {
  await Bun.write(CONFIG_PATH, JSON.stringify(e, null, 2))
}
