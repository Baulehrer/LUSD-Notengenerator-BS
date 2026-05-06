import * as fs from 'node:fs'
import * as path from 'node:path'
import * as XLSX from 'xlsx'
import type { Beruf, LernfeldId } from '../types'

const DEFAULT_DATA_URL =
  'https://schulehessen.de/LUSD-Anleitungen/Schulformbezogene%20Informationen/Berufliche%20Schulen/BS_Schulformen_Berufe_Lernfelder.xlsx'

export class BerufeLoader {
  private berufe: Map<string, Beruf> = new Map()

  private async downloadFile(url: string, destPath: string): Promise<void> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Download fehlgeschlagen: ${response.status} ${response.statusText}`)
    }
    const buffer = await response.arrayBuffer()
    await fs.promises.mkdir(path.dirname(destPath), { recursive: true })
    await fs.promises.writeFile(destPath, Buffer.from(buffer))
  }

  async load(filePath: string): Promise<void> {
    // Ensure Input/ directory exists
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true })

    const needsDownload = !fs.existsSync(filePath) || fs.statSync(filePath).size < 1000

    if (needsDownload) {
      if (fs.existsSync(filePath)) {
        console.log('Excel-Datei beschädigt oder leer — lade neu herunter...')
        await fs.promises.unlink(filePath)
      } else {
        console.log(`Lade BS_Schulformen_Berufe_Lernfelder.xlsx herunter...`)
      }
      try {
        await this.downloadFile(DEFAULT_DATA_URL, filePath)
        console.log('Download abgeschlossen.')
      } catch (err) {
        const hint = `\nBitte die Datei manuell herunterladen und nach Input/ kopieren:\n  ${DEFAULT_DATA_URL}`
        throw new Error(`Auto-Download fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}${hint}`)
      }
    }

    let workbook: XLSX.WorkBook
    try {
      workbook = XLSX.readFile(filePath)
    } catch {
      // Datei vorhanden aber nicht lesbar → löschen und neu versuchen
      await fs.promises.unlink(filePath).catch(() => {})
      console.log('Excel-Datei konnte nicht gelesen werden — lade neu herunter...')
      try {
        await this.downloadFile(DEFAULT_DATA_URL, filePath)
        workbook = XLSX.readFile(filePath)
      } catch (err2) {
        const hint = `\nBitte die Datei manuell herunterladen und nach Input/ kopieren:\n  ${DEFAULT_DATA_URL}`
        throw new Error(`Excel-Datei nicht lesbar: ${err2 instanceof Error ? err2.message : String(err2)}${hint}`)
      }
    }

    const sheet = workbook.Sheets['Berufe mit Lernfeldern']
    if (!sheet) {
      throw new Error('Sheet "Berufe mit Lernfeldern" nicht gefunden')
    }
    const data = XLSX.utils.sheet_to_json<{ Beruf: string; Fachkürzel: string; 'Stunden Lernfeld': number }>(sheet)

    const berufMap = new Map<string, Map<LernfeldId, number>>()
    for (const row of data) {
      const name = String(row.Beruf || '').trim()
      const lfId = String(row.Fachkürzel || '').trim() as LernfeldId
      const stunden = Number(row['Stunden Lernfeld']) || 0
      if (!name || !lfId.startsWith('LF')) continue
      if (!berufMap.has(name)) berufMap.set(name, new Map())
      berufMap.get(name)!.set(lfId, stunden)
    }

    for (const [name, lernfelder] of berufMap) {
      this.berufe.set(name.toLowerCase(), { name, lernfelder })
    }
  }

  getBeruf(name: string): Beruf | undefined {
    const normalized = name.toLowerCase().trim()

    // Direct match
    if (this.berufe.has(normalized)) {
      return this.berufe.get(normalized)
    }

    // Fuzzy search
    for (const [key, beruf] of this.berufe) {
      if (key.includes(normalized) || normalized.includes(key)) {
        return beruf
      }
    }

    return undefined
  }

  getAllBerufe(): string[] {
    const seen = new Set<string>()
    for (const beruf of this.berufe.values()) {
      seen.add(beruf.name)
    }
    return Array.from(seen).sort()
  }

  searchBerufe(query: string): string[] {
    const q = query.toLowerCase()
    return this.getAllBerufe().filter(b => b.toLowerCase().includes(q))
  }
}
