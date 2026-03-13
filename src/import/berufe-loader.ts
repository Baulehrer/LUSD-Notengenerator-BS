import * as XLSX from 'xlsx'
import type { Beruf, LernfeldId } from '../types'

export class BerufeLoader {
  private berufe: Map<string, Beruf> = new Map()

  async load(filePath: string): Promise<void> {
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