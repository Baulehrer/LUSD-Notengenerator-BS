import { join } from 'path'
import { INPUT_DIR } from './paths'

export interface StundenTemplate {
  id: string
  name: string
  data: {
    halbjahrStunden: Record<string, Record<string, number>>
    lfStundenOverrides: Record<string, number>
  }
}

export interface KomplettVorlage {
  id: string
  name: string
  data: {
    nachname: string
    vorname: string
    klasse?: string
    austritt?: string
    berufName: string
    halbjahre: string[]
    lernfelderNoten: Record<string, number | null>
    allgFaecherNoten: Record<string, (number | null)[]>
    halbjahrStunden: Record<string, Record<string, number>>
    lfStundenOverrides: Record<string, number>
  }
}

export interface TemplateStore {
  stundenTemplates: StundenTemplate[]
  komplettVorlagen: KomplettVorlage[]
}

const TEMPLATES_PATH = join(INPUT_DIR, 'templates.json')

export async function ladeTemplates(): Promise<TemplateStore> {
  try {
    const file = Bun.file(TEMPLATES_PATH)
    if (await file.exists()) {
      return await file.json() as TemplateStore
    }
  } catch {
    // fallback
  }
  return { stundenTemplates: [], komplettVorlagen: [] }
}

export async function speichereTemplates(store: TemplateStore): Promise<void> {
  await Bun.write(TEMPLATES_PATH, JSON.stringify(store, null, 2))
}
