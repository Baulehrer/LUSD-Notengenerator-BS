import * as p from '@clack/prompts'
import type { Berechnungsergebnis, Schueler } from '../../types'
import type { BerufeLoader } from '../../import/berufe-loader'
import { selectBerufWithSearch } from '../beruf-search'

export interface AnpassenOverrides {
  noten: Map<string, Map<string, number | null>>
  halbjahre: Map<string, string[]>
  stunden: Map<string, Map<string, number>>
  berufe: Map<string, string>
}

const NOTE_OPTIONS = [
  { value: null, label: '∅  Nicht unterrichtet' },
  { value: 1, label: '1 – sehr gut' },
  { value: 2, label: '2 – gut' },
  { value: 3, label: '3 – befriedigend' },
  { value: 4, label: '4 – ausreichend' },
  { value: 5, label: '5 – mangelhaft' },
  { value: 6, label: '6 – ungenügend' }
]

const ALL_HALBJAHRE = ['10/1', '10/2', '11/1', '11/2', '12/1', '12/2', '13/1']

function studentKey(s: Schueler) { return `${s.nachname}_${s.vorname}` }

export async function anpassenScreen(
  ergebnisse: Berechnungsergebnis[],
  berufeLoader: BerufeLoader,
  overrides: AnpassenOverrides,
  originalSchueler: Schueler[]
): Promise<void> {
  while (true) {
    const selected = await p.select({
      message: '✏️  Schüler anpassen — Schüler auswählen',
      options: [
        ...ergebnisse.map(e => {
          const key = studentKey(e.schueler)
          const hasChanges = overrides.noten.has(key) || overrides.halbjahre.has(key) || overrides.stunden.has(key)
          return {
            value: key,
            label: `${e.schueler.nachname}, ${e.schueler.vorname}${hasChanges ? ' *' : ''}`,
            hint: `BBU: ${e.bbuNoteGerundet}  Gesamt: ${e.gesamtnoteGerundet}`
          }
        }),
        { value: '__back__', label: '← Zurück' }
      ]
    })

    if (p.isCancel(selected) || selected === '__back__') return

    const erg = ergebnisse.find(e => studentKey(e.schueler) === selected)
    if (!erg) continue

    await editSchueler(erg, berufeLoader, overrides, originalSchueler)
  }
}

async function editSchueler(
  erg: Berechnungsergebnis,
  berufeLoader: BerufeLoader,
  overrides: AnpassenOverrides,
  originalSchueler: Schueler[]
): Promise<void> {
  const key = studentKey(erg.schueler)
  const name = `${erg.schueler.nachname}, ${erg.schueler.vorname}`

  while (true) {
    const action = await p.select({
      message: `✏️  ${name} anpassen`,
      options: [
        { value: 'noten', label: '📝 Einzelne Note ändern', hint: 'LF oder allgemeines Fach' },
        { value: 'halbjahre', label: '📅 Halbjahre anpassen', hint: 'Welche Semester zählen' },
        { value: 'stunden', label: '⚖️  LF-Stunden überschreiben', hint: 'Gewichtung einzelner LF ändern' },
        { value: 'beruf', label: '🎓 Beruf ändern', hint: 'Abweichenden Beruf zuweisen' },
        { value: 'reset', label: '↺  Anpassungen zurücksetzen' },
        { value: '__back__', label: '← Zurück' }
      ]
    })

    if (p.isCancel(action) || action === '__back__') return

    if (action === 'noten') {
      await editNoten(erg, overrides)
    } else if (action === 'halbjahre') {
      await editHalbjahre(erg, overrides, originalSchueler)
    } else if (action === 'stunden') {
      await editStunden(erg, berufeLoader, overrides)
    } else if (action === 'beruf') {
      await editBeruf(erg, berufeLoader, overrides)
    } else if (action === 'reset') {
      overrides.noten.delete(key)
      overrides.halbjahre.delete(key)
      overrides.stunden.delete(key)
      overrides.berufe.delete(key)
      p.log.success(`Anpassungen für ${name} zurückgesetzt`)
      return
    }
  }
}

async function editBeruf(
  erg: Berechnungsergebnis,
  berufeLoader: BerufeLoader,
  overrides: AnpassenOverrides
): Promise<void> {
  const key = studentKey(erg.schueler)
  const currentBeruf = overrides.berufe.get(key) ?? erg.schueler.beruf
  const neuerBeruf = await selectBerufWithSearch(berufeLoader, currentBeruf)
  if (!neuerBeruf) return
  overrides.berufe.set(key, neuerBeruf)
  p.log.success(`Beruf geändert: ${neuerBeruf}`)
}

async function editNoten(erg: Berechnungsergebnis, overrides: AnpassenOverrides): Promise<void> {
  const key = studentKey(erg.schueler)

  // Build list of all LF + Fächer that have any grade
  const options: { value: string; label: string; hint?: string }[] = []

  for (const [lf, noten] of erg.schueler.noten.lernfelder) {
    const currentNote = overrides.noten.get(key)?.get(lf) ?? [...noten].reverse().find(n => n.note !== null)?.note ?? null
    const noteStr = currentNote !== null ? String(currentNote) : '–'
    options.push({ value: lf, label: lf, hint: `aktuell: ${noteStr}` })
  }

  const FACH_NAMES: Record<string, string> = { D: 'Deutsch', POWI: 'Politik & Wirtschaft', RKA: 'Religion', SPO: 'Sport', ENG: 'Englisch' }
  for (const [fach, noten] of erg.schueler.noten.allgemeineFaecher) {
    const currentNote = overrides.noten.get(key)?.get(fach) ?? [...noten].reverse().find(n => n.note !== null)?.note ?? null
    const noteStr = currentNote !== null ? String(currentNote) : '–'
    options.push({ value: fach, label: FACH_NAMES[fach] ?? fach, hint: `aktuell: ${noteStr}` })
  }

  options.push({ value: '__back__', label: '← Zurück' })

  const selected = await p.select({
    message: 'Welches Fach / Lernfeld anpassen?',
    options
  })

  if (p.isCancel(selected) || selected === '__back__') return

  const currentNote = overrides.noten.get(key)?.get(selected as string)
    ?? [...(erg.schueler.noten.lernfelder.get(selected as string) ?? erg.schueler.noten.allgemeineFaecher.get(selected as string) ?? [])].reverse().find(n => n.note !== null)?.note
    ?? null

  const newNote = await p.select({
    message: `Neue Note für ${selected}`,
    options: NOTE_OPTIONS.map(o => ({
      ...o,
      label: o.value === currentNote ? `${o.label} ← aktuell` : o.label
    }))
  })

  if (p.isCancel(newNote)) return

  if (!overrides.noten.has(key)) overrides.noten.set(key, new Map())
  overrides.noten.get(key)!.set(selected as string, newNote as number | null)
  p.log.success(`${selected}: Note auf ${newNote ?? '∅'} gesetzt`)
}

async function editHalbjahre(
  erg: Berechnungsergebnis,
  overrides: AnpassenOverrides,
  originalSchueler: Schueler[]
): Promise<void> {
  const key = studentKey(erg.schueler)
  const orig = originalSchueler.find(s => studentKey(s) === key)
  const currentHJ = overrides.halbjahre.get(key) ?? orig?.halbjahre ?? ALL_HALBJAHRE

  // Use repeated select to toggle halbjahre (since multiselect may not be available)
  const available = orig?.halbjahre ?? ALL_HALBJAHRE
  let selected = new Set(currentHJ)

  while (true) {
    const action = await p.select({
      message: `Halbjahre für ${erg.schueler.nachname} (✓ = aktiv, Tippen zum Umschalten)`,
      options: [
        ...available.map(hj => ({
          value: hj,
          label: `${selected.has(hj) ? '✓' : '○'} ${hj}`
        })),
        { value: '__done__', label: '✓ Fertig' },
        { value: '__back__', label: '← Zurück ohne Speichern' }
      ]
    })

    if (p.isCancel(action) || action === '__back__') return

    if (action === '__done__') {
      if (selected.size === 0) {
        p.log.warn('Mindestens ein Halbjahr muss aktiv sein')
        continue
      }
      overrides.halbjahre.set(key, available.filter(hj => selected.has(hj)))
      p.log.success(`Halbjahre gesetzt: ${available.filter(hj => selected.has(hj)).join(', ')}`)
      return
    }

    // Toggle
    if (selected.has(action as string)) {
      selected.delete(action as string)
    } else {
      selected.add(action as string)
    }
  }
}

async function editStunden(
  erg: Berechnungsergebnis,
  berufeLoader: BerufeLoader,
  overrides: AnpassenOverrides
): Promise<void> {
  const key = studentKey(erg.schueler)
  const beruf = berufeLoader.getBeruf(erg.schueler.beruf)
  if (!beruf) { p.log.error('Beruf nicht gefunden'); return }

  const lernfelder = [...beruf.lernfelder.entries()].filter(([, s]) => s > 0)
  const options = [
    ...lernfelder.map(([lf, stunden]) => {
      const override = overrides.stunden.get(key)?.get(lf)
      const hint = override !== undefined ? `${override}h (original: ${stunden}h) *` : `${stunden}h`
      return { value: lf, label: lf, hint }
    }),
    { value: '__back__', label: '← Zurück' }
  ]

  const selected = await p.select({
    message: 'Welches Lernfeld anpassen?',
    options
  })

  if (p.isCancel(selected) || selected === '__back__') return

  const currentStunden = overrides.stunden.get(key)?.get(selected as string) ?? beruf.lernfelder.get(selected as string) ?? 0

  const newStundenStr = await p.text({
    message: `Neue Stundenanzahl für ${selected} (aktuell: ${currentStunden}h)`,
    placeholder: String(currentStunden),
    validate: (v: string | undefined) => {
      const n = parseInt(v ?? '', 10)
      return isNaN(n) || n < 0 ? 'Bitte eine positive Zahl eingeben' : undefined
    }
  })

  if (p.isCancel(newStundenStr)) return

  const newStunden = parseInt(newStundenStr, 10)
  if (!overrides.stunden.has(key)) overrides.stunden.set(key, new Map())
  overrides.stunden.get(key)!.set(selected as string, newStunden)
  p.log.success(`${selected}: Stunden auf ${newStunden}h gesetzt`)
}
