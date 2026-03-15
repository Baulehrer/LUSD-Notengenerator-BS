import * as p from '@clack/prompts'
import * as path from 'path'
import type { BerufeLoader } from '../../import/berufe-loader'
import { parseZeugnisFile, parseHistorieFile, combineZeugnisAndHistorie } from '../../import/lusd-parser'
import { calculateSchuelerNoten } from '../../core/grades'
import { generateKlassenPDF } from '../../export/pdf'
import type { Berechnungsergebnis, KlassenErgebnis } from '../../types'
import { selectFile } from '../file-browser'
import type { AnpassenOverrides } from './anpassen'

export async function klassenberechnung(berufeLoader: BerufeLoader) {
  console.clear()
  p.intro('📊 Klassenberechnung (Abschlusszeugnis)')

  // Select files
  const zeugnisFile = await selectFile('Zeugnis-Export auswählen (LUSD)', ['.xlsx'])
  if (!zeugnisFile) return

  const historieFile = await selectFile('Historie-Export auswählen (LUSD)', ['.xlsx'])
  if (!historieFile) return

  // Parse files
  p.log.step('Dateien werden geladen...')

  let zeugnisData: Map<string, { nachname: string; vorname: string; beruf: string; stufeSemester: string }>
  let historieData: Map<string, { noten: import('../../types').SchuelerNoten; klasse: string; halbjahre: string[] }>

  try {
    zeugnisData = parseZeugnisFile(zeugnisFile)
    p.log.success(`Zeugnis-Datei geladen: ${zeugnisData.size} Schüler`)
  } catch (error) {
    p.log.error(`Fehler beim Laden der Zeugnis-Datei: ${error}`)
    return
  }

  try {
    historieData = parseHistorieFile(historieFile)
    p.log.success(`Historie-Datei geladen: ${historieData.size} Einträge`)
  } catch (error) {
    p.log.error(`Fehler beim Laden der Historie-Datei: ${error}`)
    return
  }

  // Combine data
  const schuelerListe = combineZeugnisAndHistorie(zeugnisData, historieData)
  p.log.info(`${schuelerListe.length} Schüler mit Notendaten gefunden`)

  if (schuelerListe.length === 0) {
    p.log.warn('Keine Schüler mit übereinstimmenden Daten gefunden')
    return
  }

  // Select class to process
  const klassen = [...new Set(schuelerListe.map(s => s.klasse))].filter(k => k)
  
  if (klassen.length === 0) {
    p.log.warn('Keine Klassen gefunden')
    return
  }

  const selectedKlasse = klassen.length === 1 
    ? klassen[0]
    : await p.select({
        message: 'Klasse auswählen',
        options: klassen.map(k => ({ value: k, label: k }))
      })

  if (p.isCancel(selectedKlasse)) return

  // Filter students for selected class
  const klassenSchueler = schuelerListe.filter(s => s.klasse === selectedKlasse)
  p.log.info(`${klassenSchueler.length} Schüler in Klasse ${selectedKlasse}`)

  // Calculate grades
  p.log.step('Noten werden berechnet...')
  
  let ergebnisse: Berechnungsergebnis[] = []
  let skippedBerufe = 0

  for (const schueler of klassenSchueler) {
    const berufData = berufeLoader.getBeruf(schueler.beruf)
    
    if (!berufData) {
      p.log.warn(`Beruf nicht gefunden: ${schueler.beruf} (${schueler.nachname}, ${schueler.vorname})`)
      skippedBerufe++
      continue
    }

    const halbjahre = schueler.halbjahre ?? ['10/1', '10/2', '11/1', '11/2', '12/1', '12/2', '13/1']

    const ergebnis = calculateSchuelerNoten(schueler, berufData, halbjahre)
    ergebnisse.push(ergebnis)
  }

  p.log.success(`${ergebnisse.length} Schüler berechnet`)
  if (skippedBerufe > 0) {
    p.log.warn(`${skippedBerufe} Schüler übersprungen (Beruf nicht gefunden)`)
  }

  // Import anpassen screen (lazy import inside function is fine)
  const { anpassenScreen } = await import('./anpassen')

  const overrides: AnpassenOverrides = {
    noten: new Map(),
    halbjahre: new Map(),
    stunden: new Map()
  }

  // Recalculate with overrides applied
  function recalcErgebnisse(): Berechnungsergebnis[] {
    const result: Berechnungsergebnis[] = []
    let skipped = 0
    for (const schueler of klassenSchueler) {
      const berufData = berufeLoader.getBeruf(schueler.beruf)
      if (!berufData) { skipped++; continue }
      const key = `${schueler.nachname}_${schueler.vorname}`

      // Apply halbjahre override
      const halbjahre = overrides.halbjahre.get(key) ?? schueler.halbjahre ?? ['10/1', '10/2', '11/1', '11/2', '12/1', '12/2', '13/1']

      // Apply note overrides
      const notenOverride = overrides.noten.get(key)
      const schuelerFinal = notenOverride ? applyNoteOverrides(schueler, notenOverride) : schueler

      // Apply stunden overrides
      const stundenOverride = overrides.stunden.get(key)
      const berufFinal = stundenOverride ? applyStundenOverrides(berufData, stundenOverride) : berufData

      result.push(calculateSchuelerNoten(schuelerFinal, berufFinal, halbjahre))
    }
    if (skipped > 0) p.log.warn(`${skipped} Schüler übersprungen (Beruf nicht gefunden)`)
    return result
  }

  // Helper: apply note overrides to a copy of Schueler
  function applyNoteOverrides(s: typeof klassenSchueler[number], noteMap: Map<string, number | null>) {
    const lernfelder = new Map(s.noten.lernfelder)
    const allgemeineFaecher = new Map(s.noten.allgemeineFaecher)
    for (const [fach, note] of noteMap) {
      if (fach.startsWith('LF')) {
        lernfelder.set(fach, [{ note, lehrer: '' }])
      } else {
        allgemeineFaecher.set(fach, [{ note, lehrer: '' }])
      }
    }
    return { ...s, noten: { lernfelder, allgemeineFaecher } }
  }

  // Helper: apply stunden overrides to a copy of Beruf
  function applyStundenOverrides(b: import('../../types').Beruf, stundenMap: Map<string, number>) {
    return { ...b, lernfelder: new Map([...b.lernfelder, ...stundenMap]) }
  }

  // Main action loop
  while (true) {
    // Recalculate with current overrides
    ergebnisse = recalcErgebnisse()

    // Show results table
    console.clear()
    p.intro('📊 Berechnungsergebnisse')
    console.log('\nName                          BBU   Gesamt')
    console.log('─'.repeat(50))
    for (const erg of ergebnisse.slice(0, 20)) {
      const name = `${erg.schueler.nachname}, ${erg.schueler.vorname}`.substring(0, 28).padEnd(30)
      const hasOverride = overrides.noten.has(`${erg.schueler.nachname}_${erg.schueler.vorname}`) ? '*' : ' '
      console.log(`${name} ${String(erg.bbuNoteGerundet).padStart(3)}   ${String(erg.gesamtnoteGerundet).padStart(3)} ${hasOverride}`)
    }
    if (ergebnisse.length > 20) console.log(`... und ${ergebnisse.length - 20} weitere`)
    if (ergebnisse.length > 0) {
      const gesamtnoten = ergebnisse.map(e => e.gesamtnoteGerundet)
      const avg = (gesamtnoten.reduce((a, b) => a + b, 0) / gesamtnoten.length).toFixed(2)
      const min = Math.min(...gesamtnoten)
      const max = Math.max(...gesamtnoten)
      console.log('\n' + '─'.repeat(50))
      console.log(`Durchschnitt: ${avg}  |  Beste: ${max}  |  Schlechteste: ${min}`)
    }

    const action = await p.select({
      message: 'Was möchtest du tun?',
      options: [
        { value: 'pdf', label: '📄 PDF exportieren' },
        { value: 'anpassen', label: '✏️  Schüler anpassen', hint: 'Noten, Halbjahre oder LF-Stunden überschreiben' },
        { value: 'back', label: '← Zurück zum Hauptmenü' }
      ]
    })

    if (p.isCancel(action) || action === 'back') return

    if (action === 'anpassen') {
      await anpassenScreen(ergebnisse, berufeLoader, overrides, klassenSchueler)
      continue
    }

    if (action === 'pdf') {
      const outputPath = await p.text({
        message: 'Ausgabedatei',
        placeholder: `output/Klassenliste_${selectedKlasse}_${new Date().toISOString().slice(0, 10)}.pdf`,
        initialValue: `output/Klassenliste_${selectedKlasse}_${new Date().toISOString().slice(0, 10)}.pdf`
      })
      if (p.isCancel(outputPath)) continue

      const klassenErgebnis: KlassenErgebnis = {
        klasse: selectedKlasse as string,
        schuljahr: '2024/25',
        halbjahr: 'Abschluss',
        schueler: ergebnisse
      }
      try {
        const outputDir = path.dirname(outputPath)
        await Bun.write(path.join(outputDir, '.gitkeep'), '')
        await generateKlassenPDF(klassenErgebnis, outputPath)
        p.log.success(`PDF gespeichert: ${outputPath}`)
      } catch (error) {
        p.log.error(`Fehler beim PDF-Export: ${error}`)
      }
    }
  }
}
