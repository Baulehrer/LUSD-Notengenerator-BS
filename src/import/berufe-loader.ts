import * as XLSX from 'xlsx'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { Beruf, LernfeldId } from '../types'

const DEFAULT_DATA_URL = 'https://schulehessen.de/LUSD-Anleitungen/Schulformbezogene%20Informationen/Berufliche%20Schulen/BS_Schulformen_Berufe_Lernfelder.xlsx'

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
    // Auto-download if file doesn't exist
    if (!fs.existsSync(filePath)) {
      console.log(`Datei nicht gefunden: ${filePath}`)
      console.log('Lade BS_Schulformen_Berufe_Lernfelder.xlsx herunter...')
      await this.downloadFile(DEFAULT_DATA_URL, filePath)
      console.log('Download abgeschlossen.')
    }
    const workbook = XLSX.readFile(filePath)
    const sheet = workbook.Sheets['Berufe mit Lernfeldern']
    if (!sheet) {
      throw new Error('Sheet "Berufe mit Lernfeldern" nicht gefunden')
    }
    const data = XLSX.utils.sheet_to_json<{ Beruf: string; Fachkürzel: string; 'Stunden Lernfeld': number }>(sheet)
    
    // Group by Beruf
    const berufMap = new Map<string, Map<LernfeldId, number>>()
    
    for (const row of data) {
      const name = String(row.Beruf || '').trim()
      const lfId = String(row.Fachkürzel || '').trim() as LernfeldId
      const stunden = Number(row['Stunden Lernfeld']) || 0
      
      if (!name || !lfId.startsWith('LF')) continue
      
      if (!berufMap.has(name)) {
        berufMap.set(name, new Map())
      }
      
      berufMap.get(name)!.set(lfId, stunden)
    }
    
    // Convert to Beruf objects
    for (const [name, lernfelder] of berufMap) {
      const beruf: Beruf = {
        name,
        lernfelder
      }
      this.berufe.set(name.toLowerCase(), beruf)
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