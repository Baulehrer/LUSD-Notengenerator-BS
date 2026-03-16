import * as p from '@clack/prompts'
import type { BerufeLoader } from '../../import/berufe-loader'
import type { Schueler, NoteEintrag } from '../../types'
import { calculateSchuelerNoten } from '../../core/grades'
import { generatePDF } from '../../export/pdf'
import { selectBerufWithSearch } from '../beruf-search'

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

  const stufeSemester = await p.select({
    message: 'Stufe / Semester',
    options: [
      { value: '10/1', label: '10/1' },
      { value: '10/2', label: '10/2' },
      { value: '11/1', label: '11/1' },
      { value: '11/2', label: '11/2' },
      { value: '12/1', label: '12/1' },
      { value: '12/2', label: '12/2' },
      { value: '13/1', label: '13/1' },
    ]
  })

  if (p.isCancel(stufeSemester)) return

  const berufName = await selectBerufWithSearch(berufeLoader)
  if (!berufName) return

  let berufData = berufeLoader.getBeruf(berufName)
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
  
  let schueler: Schueler = {
    nachname: schuelerName.split(',')[0]?.trim() || schuelerName,
    vorname: schuelerName.split(',')[1]?.trim() || '',
    klasse: klasse,
    beruf: berufData.name,
    stufeSemester: stufeSemester as string,
    noten: {
      lernfelder: lernfeldNoten,
      allgemeineFaecher: allgFachNoten
    }
  }

  // Action loop: show result, allow editing, PDF export
  while (true) {
    const ergebnis = calculateSchuelerNoten(schueler, berufData, HALBJAHRE)

    console.clear()
    p.intro('📊 Berechnungsergebnis')

    const bbuRaw = typeof ergebnis.bbuNote === 'number' ? ergebnis.bbuNote.toFixed(2) : '–'
    const gesamtRaw = typeof ergebnis.gesamtnote === 'number' ? ergebnis.gesamtnote.toFixed(2) : '–'

    p.note(
      [
        `Klasse:        ${ergebnis.schueler.klasse}`,
        `Beruf:         ${ergebnis.schueler.beruf}`,
        `${'─'.repeat(38)}`,
        `BBU-Note:      ${bbuRaw}  →  gerundet: ${ergebnis.bbuNoteGerundet}`,
        `Gesamtnote:    ${gesamtRaw}  →  gerundet: ${ergebnis.gesamtnoteGerundet}`,
        `${'─'.repeat(38)}`,
        `Stunden BBU:   ${ergebnis.stundenBBU}`,
        `Stunden Allg.: ${ergebnis.stundenAllg}`,
      ].join('\n'),
      `${ergebnis.schueler.nachname}, ${ergebnis.schueler.vorname}`
    )

    const action = await p.select({
      message: 'Was möchtest du tun?',
      options: [
        { value: 'pdf', label: '📄 PDF exportieren' },
        { value: 'note', label: '📝 Note ändern' },
        { value: 'beruf', label: '🎓 Beruf ändern' },
        { value: 'back', label: '← Zurück' }
      ]
    })

    if (p.isCancel(action) || action === 'back') return

    if (action === 'pdf') {
      const outputPath = `output/${schueler.nachname}_${schueler.vorname}_noten.pdf`
      try {
        await generatePDF([ergebnis], outputPath, { beruf: berufData, halbjahre: HALBJAHRE })
        p.log.success(`PDF gespeichert: ${outputPath}`)
      } catch (error) {
        p.log.error(`Fehler beim PDF-Export: ${error}`)
      }
      continue
    }

    if (action === 'beruf') {
      const neuerBeruf = await selectBerufWithSearch(berufeLoader, schueler.beruf)
      if (neuerBeruf) {
        const neuesBerufData = berufeLoader.getBeruf(neuerBeruf)
        if (neuesBerufData) {
          berufData = neuesBerufData
          schueler = { ...schueler, beruf: neuesBerufData.name }
        }
      }
      continue
    }

    if (action === 'note') {
      // Select Fach/LF
      const NOTE_OPTIONS_EDIT = [
        { value: null, label: '∅  Nicht unterrichtet' },
        { value: 1, label: '1 – sehr gut' },
        { value: 2, label: '2 – gut' },
        { value: 3, label: '3 – befriedigend' },
        { value: 4, label: '4 – ausreichend' },
        { value: 5, label: '5 – mangelhaft' },
        { value: 6, label: '6 – ungenügend' }
      ]
      const FACH_NAMES: Record<string, string> = { D: 'Deutsch', POWI: 'Politik & Wirtschaft', RKA: 'Religion', SPO: 'Sport', ENG: 'Englisch' }
      const fachOptions: { value: string; label: string; hint?: string }[] = []
      for (const [lf, eintraege] of schueler.noten.lernfelder) {
        const note = [...eintraege].reverse().find(n => n.note !== null)?.note ?? null
        fachOptions.push({ value: lf, label: lf, hint: note !== null ? String(note) : '–' })
      }
      for (const [fach, eintraege] of schueler.noten.allgemeineFaecher) {
        const note = [...eintraege].reverse().find(n => n.note !== null)?.note ?? null
        fachOptions.push({ value: fach, label: FACH_NAMES[fach] ?? fach, hint: note !== null ? String(note) : '–' })
      }
      fachOptions.push({ value: '__back__', label: '← Zurück' })

      const fach = await p.select({ message: 'Welches Fach / Lernfeld?', options: fachOptions })
      if (p.isCancel(fach) || fach === '__back__') continue

      const newNote = await p.select({ message: `Neue Note für ${fach}`, options: NOTE_OPTIONS_EDIT })
      if (p.isCancel(newNote)) continue

      const note = newNote as number | null
      const lernfelder = new Map(schueler.noten.lernfelder)
      const allgemeineFaecher = new Map(schueler.noten.allgemeineFaecher)
      if (lernfelder.has(fach as string)) {
        lernfelder.set(fach as string, [{ note, lehrer: '' }])
      } else {
        allgemeineFaecher.set(fach as string, [{ note, lehrer: '' }])
      }
      schueler = { ...schueler, noten: { lernfelder, allgemeineFaecher } }
    }
  }
}
