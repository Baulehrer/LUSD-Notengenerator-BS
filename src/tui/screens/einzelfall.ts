import * as p from '@clack/prompts'
import type { BerufeLoader } from '../../import/berufe-loader'
import type { Schueler, NoteEintrag } from '../../types'
import type { Einstellungen } from '../../config/einstellungen'
import { calculateSchuelerNoten } from '../../core/grades'
import { generatePDF } from '../../export/pdf'
import { selectBerufWithSearch } from '../beruf-search'

const LERNFELDER = ['LF01', 'LF02', 'LF03', 'LF04', 'LF05', 'LF06', 'LF07', 'LF08', 'LF09', 'LF10', 'LF11', 'LF12', 'LF13', 'LF14', 'LF15', 'LF16', 'LF17', 'LF18'] as const
const ALLGEMEINE_FAECHER = ['D', 'POWI', 'RKA', 'SPO', 'ENG'] as const
const ALL_HJ = ['10/2', '11/1', '11/2', '12/1', '12/2', '13/1']

const FACH_NAMEN: Record<string, string> = {
  D: 'Deutsch',
  POWI: 'Politik & Wirtschaft',
  RKA: 'Religion',
  SPO: 'Sport',
  ENG: 'Englisch'
}

const NOTE_OPTIONS = [
  { value: 0, label: 'Nicht unterrichtet' },
  { value: 1, label: '1 (sehr gut)' },
  { value: 2, label: '2 (gut)' },
  { value: 3, label: '3 (befriedigend)' },
  { value: 4, label: '4 (ausreichend)' },
  { value: 5, label: '5 (mangelhaft)' },
  { value: 6, label: '6 (ungenügend)' }
]

const NOTE_OPTIONS_EDIT = [
  { value: null, label: '∅  Nicht unterrichtet' },
  { value: 1, label: '1 – sehr gut' },
  { value: 2, label: '2 – gut' },
  { value: 3, label: '3 – befriedigend' },
  { value: 4, label: '4 – ausreichend' },
  { value: 5, label: '5 – mangelhaft' },
  { value: 6, label: '6 – ungenügend' }
]

function getHalbjahre(stufeSemester: string): string[] {
  const idx = ALL_HJ.indexOf(stufeSemester)
  if (idx === -1) return []
  return ALL_HJ.slice(0, idx + 1)
}

export async function einzelfallBerechnung(berufeLoader: BerufeLoader, einstellungen: Einstellungen) {
  console.clear()
  p.intro('📝 Einzelfallberechnung (Abgangszeugnis)')

  // ── Einstieg: Eingabe-Modus ─────────────────────────────────────
  const modus = await p.select({
    message: 'Wie möchtest du Noten eingeben?',
    options: [
      { value: 'manuell', label: 'Manuelle Eingabe' },
      { value: 'historie', label: 'Aus Leistungshistorie (bald verfügbar)' }
    ]
  })

  if (p.isCancel(modus)) return

  if (modus === 'historie') {
    p.log.info('Noch nicht implementiert')
    return
  }

  // ── Schüler-Daten ───────────────────────────────────────────────
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
    message: 'Ausscheide-Semester',
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

  const HALBJAHRE = getHalbjahre(stufeSemester as string)

  const berufName = await selectBerufWithSearch(berufeLoader)
  if (!berufName) return

  let berufData = berufeLoader.getBeruf(berufName)
  if (!berufData) {
    p.log.error('Beruf nicht gefunden')
    return
  }

  p.log.info(`Beruf: ${berufData.name}`)
  p.log.info(`Lernfelder-Stunden: ${Array.from(berufData.lernfelder.entries()).filter(([_, s]) => s > 0).map(([lf, s]) => `${lf}=${s}`).join(', ')}`)

  // ── LF-Noten ────────────────────────────────────────────────────
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
      options: NOTE_OPTIONS
    })

    if (p.isCancel(noteInput)) return

    const note = noteInput === 0 ? null : noteInput as number
    lernfeldNoten.set(lf, [{ note, lehrer: '' }])
  }

  // ── Allg. Fächer: pro Halbjahr ──────────────────────────────────
  const allgFachNoten = new Map<string, NoteEintrag[]>()

  p.log.step('Noten allgemeine Fächer')

  for (const fach of ALLGEMEINE_FAECHER) {
    const fachName = FACH_NAMEN[fach] || fach

    if (HALBJAHRE.length === 0) {
      allgFachNoten.set(fach, [{ note: null, lehrer: '' }])
      continue
    }

    const notenFuerFach: NoteEintrag[] = []

    for (const hj of HALBJAHRE) {
      const stunden = einstellungen.halbjahrStunden[hj] ?? 0
      const noteInput = await p.select({
        message: `${fachName} in ${hj} (${stunden}h)`,
        options: NOTE_OPTIONS
      })

      if (p.isCancel(noteInput)) return

      const note = noteInput === 0 ? null : noteInput as number
      notenFuerFach.push({ note, lehrer: '' })
    }

    allgFachNoten.set(fach, notenFuerFach)
  }

  // ── Schüler-Objekt ──────────────────────────────────────────────
  let schueler: Schueler = {
    nachname: schuelerName.split(',')[0]?.trim() || schuelerName as string,
    vorname: schuelerName.split(',')[1]?.trim() || '',
    klasse: klasse as string,
    beruf: berufData.name,
    stufeSemester: stufeSemester as string,
    halbjahre: HALBJAHRE,
    noten: {
      lernfelder: lernfeldNoten,
      allgemeineFaecher: allgFachNoten
    }
  }

  // ── Action-Loop ─────────────────────────────────────────────────
  while (true) {
    const ergebnis = calculateSchuelerNoten(schueler, berufData, HALBJAHRE, einstellungen.halbjahrStunden)

    console.clear()
    p.intro('📊 Berechnungsergebnis')

    const bbuRaw = ergebnis.bbuNote.toFixed(2)
    const gesamtRaw = ergebnis.gesamtnote.toFixed(2)

    // Build allg. Fächer detail lines
    const allgLines: string[] = []
    for (const fach of ALLGEMEINE_FAECHER) {
      const fachName = FACH_NAMEN[fach] || fach
      const notenListe = schueler.noten.allgemeineFaecher.get(fach) || []
      const hjTeile: string[] = []
      let hasAny = false
      for (let i = 0; i < HALBJAHRE.length; i++) {
        const hj = HALBJAHRE[i]!
        const note = notenListe[i]?.note
        if (note !== null && note !== undefined && note > 0) {
          hjTeile.push(`${hj}: ${note}`)
          hasAny = true
        }
      }
      if (!hasAny) continue
      const fachErgebnis = ergebnis.allgemeineFaecherNoten.get(fach)
      const endnote = fachErgebnis?.note.toFixed(2) ?? '–'
      const vorschlag = fachErgebnis?.noteGerundet ?? '–'
      allgLines.push(`  ${fachName.padEnd(22)} ${hjTeile.join(' | ')}`)
      allgLines.push(`  ${''.padEnd(22)} Endnote: ${endnote}  Vorschlag: ${vorschlag}`)
    }

    p.note(
      [
        `Klasse:        ${ergebnis.schueler.klasse}`,
        `Beruf:         ${ergebnis.schueler.beruf}`,
        `${'─'.repeat(46)}`,
        `BBU-Note:      ${bbuRaw}  →  gerundet: ${ergebnis.bbuNoteGerundet}`,
        `Gesamtnote:    ${gesamtRaw}  (abgerundet, 2 NKS: ${ergebnis.gesamtnote.toFixed(2)})`,
        `${'─'.repeat(46)}`,
        'Allgemeine Fächer:',
        ...allgLines,
        `${'─'.repeat(46)}`,
        `Stunden BBU:   ${ergebnis.stundenBBU}     Stunden Allg.: ${ergebnis.stundenAllg}`,
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
        await generatePDF([ergebnis], outputPath, {
          beruf: berufData,
          halbjahre: HALBJAHRE,
          halbjahrStunden: einstellungen.halbjahrStunden
        })
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
      const fachOptions: { value: string; label: string; hint?: string }[] = []

      for (const [lf, eintraege] of schueler.noten.lernfelder) {
        const note = [...eintraege].reverse().find(n => n.note !== null)?.note ?? null
        fachOptions.push({ value: lf, label: lf, hint: note !== null ? String(note) : '–' })
      }

      for (const fach of ALLGEMEINE_FAECHER) {
        const fachErgebnis = ergebnis.allgemeineFaecherNoten.get(fach)
        const endnote = fachErgebnis && fachErgebnis.note > 0 ? fachErgebnis.note.toFixed(2) : '–'
        fachOptions.push({ value: fach, label: FACH_NAMEN[fach] ?? fach, hint: endnote })
      }

      fachOptions.push({ value: '__back__', label: '← Zurück' })

      const fach = await p.select({ message: 'Welches Fach / Lernfeld?', options: fachOptions })
      if (p.isCancel(fach) || fach === '__back__') continue

      const isAllgFach = ALLGEMEINE_FAECHER.includes(fach as typeof ALLGEMEINE_FAECHER[number])

      if (isAllgFach && HALBJAHRE.length > 1) {
        // Edit per-HJ: first select which HJ
        const currentNoten = schueler.noten.allgemeineFaecher.get(fach as string) || []
        const hjOptions = HALBJAHRE.map((hj, i) => {
          const note = currentNoten[i]?.note
          return { value: hj, label: hj, hint: note !== null && note !== undefined ? String(note) : '–' }
        })
        hjOptions.push({ value: '__back__', label: '← Zurück', hint: '' })

        const hjSelection = await p.select({ message: `Welches Halbjahr für ${FACH_NAMEN[fach as string] ?? fach}?`, options: hjOptions })
        if (p.isCancel(hjSelection) || hjSelection === '__back__') continue

        const hjIdx = HALBJAHRE.indexOf(hjSelection as string)
        const newNote = await p.select({ message: `Neue Note für ${fach} in ${hjSelection}`, options: NOTE_OPTIONS_EDIT })
        if (p.isCancel(newNote)) continue

        const note = newNote as number | null
        const allgemeineFaecher = new Map(schueler.noten.allgemeineFaecher)
        const updatedNoten = [...(allgemeineFaecher.get(fach as string) || [])]
        updatedNoten[hjIdx] = { note, lehrer: '' }
        allgemeineFaecher.set(fach as string, updatedNoten)
        schueler = { ...schueler, noten: { ...schueler.noten, allgemeineFaecher } }
      } else {
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
}
