import * as p from '@clack/prompts'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { loadHistory, saveHistory } from './history'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export async function selectFile(
  message: string,
  extensions?: string[]
): Promise<string | null> {
  const history = loadHistory()
  let currentDir = history.lastDir && fs.existsSync(history.lastDir)
    ? history.lastDir
    : process.cwd()

  while (true) {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true })
    } catch {
      p.log.error(`Kein Zugriff auf: ${currentDir}`)
      currentDir = path.dirname(currentDir)
      continue
    }

    const dirs = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .sort((a, b) => a.name.localeCompare(b.name))

    const files = entries
      .filter(e => {
        if (!e.isFile()) return false
        if (!extensions || extensions.length === 0) return true
        return extensions.some(ext => e.name.toLowerCase().endsWith(ext.toLowerCase()))
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    const options: { value: string; label: string; hint?: string }[] = []

    const parentDir = path.dirname(currentDir)
    if (parentDir !== currentDir) {
      options.push({ value: '__UP__', label: '📁 ..' })
    }

    for (const dir of dirs) {
      const dirPath = path.join(currentDir, dir.name)
      let hint = ''
      try {
        const stat = fs.statSync(dirPath)
        hint = formatDate(stat.mtime)
      } catch { /* ignore */ }
      options.push({ value: dirPath, label: `📁 ${dir.name}/`, hint })
    }

    for (const file of files) {
      const filePath = path.join(currentDir, file.name)
      let hint = ''
      try {
        const stat = fs.statSync(filePath)
        hint = `${formatSize(stat.size)}  ·  ${formatDate(stat.mtime)}`
      } catch { /* ignore */ }
      options.push({ value: filePath, label: `📄 ${file.name}`, hint })
    }

    options.push({ value: '__MANUAL__', label: '✏️  Pfad manuell eingeben' })
    options.push({ value: '__CANCEL__', label: '✕ Abbrechen' })

    const selected = await p.select({
      message: `${message}\n  📂 ${currentDir}`,
      options
    })

    if (p.isCancel(selected)) return null

    if (selected === '__CANCEL__') return null

    if (selected === '__UP__') {
      currentDir = path.dirname(currentDir)
      continue
    }

    if (selected === '__MANUAL__') {
      const manual = await p.text({
        message: 'Dateipfad eingeben',
        validate: (v) => v?.trim() ? undefined : 'Pfad ist erforderlich'
      })
      if (p.isCancel(manual)) return null
      saveHistory({ lastDir: path.dirname(manual) })
      return manual
    }

    // Navigate into directory
    try {
      const stat = fs.statSync(selected)
      if (stat.isDirectory()) {
        currentDir = selected
        continue
      }
    } catch { /* ignore */ }

    // File selected — save directory to history
    saveHistory({ lastDir: path.dirname(selected) })
    return selected
  }
}
