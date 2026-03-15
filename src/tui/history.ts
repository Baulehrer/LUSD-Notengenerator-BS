import * as path from 'node:path'
import * as os from 'node:os'
import * as fs from 'node:fs'

const CONFIG_DIR = path.join(os.homedir(), '.config', 'lusd-notengenerator')
const CONFIG_FILE = path.join(CONFIG_DIR, 'history.json')

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
