import * as path from 'node:path'
import * as os from 'node:os'
import * as fs from 'node:fs'
import type { EinzelfallDraft } from '../types'

const CONFIG_DIR = path.join(os.homedir(), '.config', 'lusd-notengenerator')
const CONFIG_FILE = path.join(CONFIG_DIR, 'history.json')
const DRAFTS_DIR = path.join(CONFIG_DIR, 'drafts')

interface History {
  lastDir?: string
}

export function loadHistory(): History {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8')
    return JSON.parse(raw) as History
  } catch {
    return {}
  }
}

export function saveHistory(update: Partial<History>): void {
  try {
    const current = loadHistory()
    const merged = { ...current, ...update }
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2))
  } catch {
    // non-fatal — silently ignore
  }
}

// ── Einzelfall Drafts ─────────────────────────────────────

export function loadEinzelfallDrafts(): EinzelfallDraft[] {
  try {
    fs.mkdirSync(DRAFTS_DIR, { recursive: true })
    const files = fs.readdirSync(DRAFTS_DIR).filter(f => f.endsWith('.json'))
    const drafts: EinzelfallDraft[] = []
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(DRAFTS_DIR, file), 'utf-8')
        drafts.push(JSON.parse(raw) as EinzelfallDraft)
      } catch {
        // Skip invalid draft files
      }
    }
    return drafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  } catch {
    return []
  }
}

export function saveEinzefallDraft(draft: EinzelfallDraft): void {
  try {
    fs.mkdirSync(DRAFTS_DIR, { recursive: true })
    const filePath = path.join(DRAFTS_DIR, `${draft.id}.json`)
    fs.writeFileSync(filePath, JSON.stringify(draft, null, 2))
  } catch {
    // non-fatal — silently ignore
  }
}

export function deleteEinzefallDraft(id: string): void {
  try {
    const filePath = path.join(DRAFTS_DIR, `${id}.json`)
    fs.unlinkSync(filePath)
  } catch {
    // non-fatal — silently ignore
  }
}

export function getEinzelfallDraftPath(id: string): string {
  return path.join(DRAFTS_DIR, `${id}.json`)
}
