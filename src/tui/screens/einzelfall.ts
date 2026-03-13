import * as p from '@clack/prompts'
import type { BerufeLoader } from '../../import/berufe-loader'
import type { Schueler, NoteEintrag } from '../../types'
import { calculateSchuelerNoten } from '../../core/grades'
import { generatePDF } from '../../export/pdf'

const LERNFELDER = ['LF01', 'LF02', 'LF03', 'LF04', 'LF05', 'LF06', 'LF07', 'LF08', 'LF09', 'LF10', 'LF11', 'LF12', 'LF13', 'LF14', 'LF15', 'LF16', 'LF17', 'LF18'] as const
const ALLGEMEINE_FAECHER = ['D', 'POWI', 'RKA', 'SPO', 'ENG'] as const
const HALBJAHRE = ['10/1', '10/2', '11/1', '11/2', '12/1', '12/2', '13/1']

export async function einzelfallBerechnung(berufeLoader: BerufeLoader) {
  console.clear()
  p.intro('📝 Einzelfallberechnung (Abgangszeugnis)')
  
  const schuelerName = await p.text({
    message: 'Name des Schülers',
    placeholder: 'Nachname, Vorname',
    validate: (value) => value?.trim() ? undefined : 'Name ist erforderlich'
  })
  
  if (p.isCancel(schuelerName)) return
  
  const klasse = await p.text({
    message: 'Klasse',
    placeholder: 'z.B. 11B501',
    validate: (value) => value?.trim() ? undefined : 'Klasse ist erforderlich'
  })
  
  if (p.isCancel(klasse)) return
  
  const berufe = berufeLoader.getAllBerufe()
  const beruf = await p.select({
    message: 'Ausbildungsberuf',
    options: berufe.slice(0, 50).map(b => ({ value: b, label: b })),
    maxItems: 20
  })
  
  if (p.isCancel(beruf)) return
  
  const berufData = berufeLoader.getBeruf(beruf as string)
  if (!berufData) {
    p.log.error('Beruf nicht gefunden')
    return
  }
  
  p.log.info(`Beruf: ${berufData.name}`)
  p.log.info(`Lernfelder-Stunden: ${Array.from(berufData.lernfelder.entries()).filter(([_, s]) => s > 0).map(([lf, s]) => `${lf}=${s}`).join(', ')}`)
  
  const lernfeldNoten = new Map<string, NoteEintrag[]>()
  
  p.log.step('Noten der Lernfelder eingeben (1-6, oder 0 für nicht unterrichtet)')
  
  for (const lf of LERNFELDER) {
    const stunden = berufData.lernfelder.get(lf) ?? 0
    if (stunden === 0) {
      lernfeldNoten.set(lf, [{ note: null, lehrer: '' }])
      continue
    }
    
    const noteInput = await p.select({
      message: `${lf} (${stunden}h)`,
      options: [
        { value: 0, label: 'Nicht unterrichtet' },
        { value: 1, label: '1 (sehr gut)' },
        { value: 2, label: '2 (gut)' },
        { value: 3, label: '3 (befriedigend)' },
        { value: 4, label: '4 (ausreichend)' },
        { value: 5, label: '5 (mangelhaft)' },
        { value: 6, label: '6 (ungenügend)' }
      ]
    })
    
    if (p.isCancel(noteInput)) return
    
    const note = noteInput === 0 ? null : noteInput as number
    lernfeldNoten.set(lf, [{ note, lehrer: '' }])
  }
  
  const allgFachNoten = new Map<string, NoteEintrag[]>()
  
  p.log.step('Noten der allgemeinen Fächer eingeben')
  
  for (const fach of ALLGEMEINE_FAECHER) {
    const fachName = { D: 'Deutsch', POWI: 'Politik & Wirtschaft', RKA: 'Religion', SPO: 'Sport', ENG: 'Englisch' }[fach] || fach
    
    const noteInput = await p.select({
      message: fachName,
      options: [
        { value: 0, label: 'Nicht unterrichtet' },
        { value: 1, label: '1 (sehr gut)' },
        { value: 2, label: '2 (gut)' },
        { value: 3, label: '3 (befriedigend)' },
        { value: 4, label: '4 (ausreichend)' },
        { value: 5, label: '5 (mangelhaft)' },
        { value: 6, label: '6 (ungenügend)' }
      ]
    })
    
    if (p.isCancel(noteInput)) return
    
    const note = noteInput === 0 ? null : noteInput as number
    allgFachNoten.set(fach, [{ note, lehrer: '' }])
  }
  
  const schueler: Schueler = {
    nachname: schuelerName.split(',')[0]?.trim() || schuelerName,
    vorname: schuelerName.split(',')[1]?.trim() || '',
    klasse: klasse,
    beruf: berufData.name,
    stufeSemester: '11/2',
    noten: {
      lernfelder: lernfeldNoten,
      allgemeineFaecher: allgFachNoten
    }
  }
  
  const ergebnis = calculateSchuelerNoten(schueler, berufData, HALBJAHRE)
  
  console.clear()
  p.intro('📊 Berechnungsergebnis')
  
  const table = [
    ['Schüler:', `${ergebnis.schueler.nachname}, ${ergebnis.schueler.vorname}`],
    ['Klasse:', ergebnis.schueler.klasse],
    ['Beruf:', ergebnis.schueler.beruf],
    ['─'.repeat(30), '─'.repeat(30)],
    ['BBU-Note:', `${ergebnis.bbuNote} (gerundet: ${ergebnis.bbuNoteGerundet})`],
    ['Gesamtnote:', `${ergebnis.gesamtnote} (gerundet: ${ergebnis.gesamtnoteGerundet})`],
    ['─'.repeat(30), '─'.repeat(30)],
    ['Stunden BBU:', String(ergebnis.stundenBBU)],
    ['Stunden Allg.:', String(ergebnis.stundenAllg)],
  ]
  
  for (const row of table) {
    const label = row[0] ?? ''
    const value = row[1] ?? ''
    console.log(`${label.padEnd(20)} ${value}`)
  }
  
  const doExport = await p.confirm({
    message: 'PDF exportieren?',
    initialValue: true
  })
  
  if (p.isCancel(doExport)) return
  
  if (doExport) {
    const outputPath = `output/${schueler.nachname}_${schueler.vorname}_noten.pdf`
    await generatePDF([ergebnis], outputPath)
    p.log.success(`PDF gespeichert: ${outputPath}`)
  }
  
  await p.confirm({ message: 'Drücke Enter um fortzufahren' })
}
