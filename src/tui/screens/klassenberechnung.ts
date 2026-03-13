import * as p from '@clack/prompts'
import * as path from 'path'
import type { BerufeLoader } from '../../import/berufe-loader'
import { parseZeugnisFile, parseHistorieFile, combineZeugnisAndHistorie } from '../../import/lusd-parser'
import { calculateSchuelerNoten } from '../../core/grades'
import { generateKlassenPDF } from '../../export/pdf'
import type { Berechnungsergebnis, KlassenErgebnis } from '../../types'

export async function klassenberechnung(berufeLoader: BerufeLoader) {
  console.clear()
  p.intro('📊 Klassenberechnung (Abschlusszeugnis)')

  // Select files
  const zeugnisFile = await p.text({
    message: 'Pfad zur Zeugnis-Export-Datei (LUSD)',
    placeholder: 'Vorlage/_Zeugnis_221333.xlsx',
    validate: (value) => value?.trim() ? undefined : 'Pfad ist erforderlich'
  })

  if (p.isCancel(zeugnisFile)) return

  const historieFile = await p.text({
    message: 'Pfad zur Historie-Export-Datei (LUSD)',
    placeholder: 'Vorlage/Schüler-Historie_221204.xlsx',
    validate: (value) => value?.trim() ? undefined : 'Pfad ist erforderlich'
  })

  if (p.isCancel(historieFile)) return

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
  
  const ergebnisse: Berechnungsergebnis[] = []
  let skippedBerufe = 0

  for (const schueler of klassenSchueler) {
    const berufData = berufeLoader.getBeruf(schueler.beruf)
    
    if (!berufData) {
      p.log.warn(`Beruf nicht gefunden: ${schueler.beruf} (${schueler.nachname}, ${schueler.vorname})`)
      skippedBerufe++
      continue
    }

    // Get halbjahre from historie data
    const schuelerKey = `${schueler.nachname}_${schueler.vorname}`
    const historieEntry = historieData.get(schuelerKey)
    const halbjahre = historieEntry?.halbjahre ?? ['10/1', '10/2', '11/1', '11/2', '12/1', '12/2', '13/1']

    const ergebnis = calculateSchuelerNoten(schueler, berufData, halbjahre)
    ergebnisse.push(ergebnis)
  }

  p.log.success(`${ergebnisse.length} Schüler berechnet`)
  if (skippedBerufe > 0) {
    p.log.warn(`${skippedBerufe} Schüler übersprungen (Beruf nicht gefunden)`)
  }

  // Show results preview
  console.clear()
  p.intro('📊 Berechnungsergebnisse')

  console.log('\nName                          BBU   Gesamt')
  console.log('─'.repeat(50))
  
  for (const erg of ergebnisse.slice(0, 15)) {
    const name = `${erg.schueler.nachname}, ${erg.schueler.vorname}`.substring(0, 28).padEnd(30)
    console.log(`${name} ${String(erg.bbuNoteGerundet).padStart(3)}   ${String(erg.gesamtnoteGerundet).padStart(3)}`)
  }
  
  if (ergebnisse.length > 15) {
    console.log(`... und ${ergebnisse.length - 15} weitere`)
  }

  // Statistics
  if (ergebnisse.length > 0) {
    const gesamtnoten = ergebnisse.map(e => e.gesamtnoteGerundet)
    const avg = gesamtnoten.reduce((a, b) => a + b, 0) / gesamtnoten.length
    const min = Math.min(...gesamtnoten)
    const max = Math.max(...gesamtnoten)
    
    console.log('\n─'.repeat(50))
    console.log(`Durchschnitt: ${avg.toFixed(2)}  |  Beste: ${max}  |  Schlechteste: ${min}`)
  }

  // Export options
  const doExport = await p.confirm({
    message: 'PDF-Klassenliste exportieren?',
    initialValue: true
  })

  if (p.isCancel(doExport)) return

  if (doExport) {
    const outputPath = await p.text({
      message: 'Ausgabedatei',
      placeholder: `output/Klassenliste_${selectedKlasse}_${new Date().toISOString().slice(0, 10)}.pdf`,
      initialValue: `output/Klassenliste_${selectedKlasse}_${new Date().toISOString().slice(0, 10)}.pdf`
    })

    if (p.isCancel(outputPath)) return

    const klassenErgebnis: KlassenErgebnis = {
      klasse: selectedKlasse as string,
      schuljahr: '2024/25',
      halbjahr: 'Abschluss',
      schueler: ergebnisse
    }

    try {
      // Ensure output directory exists
      const outputDir = path.dirname(outputPath)
      await Bun.write(path.join(outputDir, '.gitkeep'), '')
      
      await generateKlassenPDF(klassenErgebnis, outputPath)
      p.log.success(`PDF gespeichert: ${outputPath}`)
    } catch (error) {
      p.log.error(`Fehler beim PDF-Export: ${error}`)
    }
  }

  await p.confirm({ message: 'Drücke Enter um fortzufahren' })
}
