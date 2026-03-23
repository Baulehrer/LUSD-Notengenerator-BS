import * as p from '@clack/prompts'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { BerufeLoader } from '../../import/berufe-loader'
import type { Schueler, NoteEintrag, EinzelfallDraft, EinzelfallStep } from '../../types'
import type { Einstellungen } from '../../config/einstellungen'
import { calculateSchuelerNoten } from '../../core/grades'
import { generatePDF } from '../../export/pdf'
import { selectBerufWithSearch } from '../beruf-search'
import { loadEinzelfallDrafts, saveEinzefallDraft, deleteEinzefallDraft } from '../history'
import { STEP_TIPS } from '../tips'
import { promptNoteScale } from '../note-scale'
import type { Beruf } from '../../types'
import { OUTPUT_DIR } from '../../config/paths'

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

// ── Undo ─────────────────────────────────────────────────────────────────────

interface UndoEntry {
  field: string
  hjIndex?: number
  oldNote: number | null
  newNote: number | null
}

class UndoStack {
  private stack: UndoEntry[] = []
  private maxSize = 5

  push(entry: UndoEntry): void {
    this.stack.push(entry)
    if (this.stack.length > this.maxSize) this.stack.shift()
  }

  pop(): UndoEntry | undefined {
    return this.stack.pop()
  }

  getAll(): UndoEntry[] {
    return [...this.stack]
  }

  get size(): number {
    return this.stack.length
  }
}

// ── Session State ─────────────────────────────────────────────────────────────

interface SessionState {
  draftId: string
  currentStep: EinzelfallStep | 'done'
  schueler: Partial<Schueler>
  berufName: string | null
  halbjahre: string[]
  lastNote: number | null
  undoStack: UndoStack
  isDirty: boolean
  lfStundenOverrides: Map<string, number>
  halbjahrStundenOverrides: Record<string, number>
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildSchueler(state: SessionState): Schueler {
  return {
    nachname: state.schueler.nachname ?? '',
    vorname: state.schueler.vorname ?? '',
    klasse: state.schueler.klasse ?? '',
    beruf: state.berufName ?? '',
    stufeSemester: state.schueler.stufeSemester ?? '',
    halbjahre: state.halbjahre,
    noten: {
      lernfelder: state.schueler.noten?.lernfelder ?? new Map(),
      allgemeineFaecher: state.schueler.noten?.allgemeineFaecher ?? new Map(),
    }
  }
}

// ── LF-Kappung ──────────────────────────────────────────────────────────────

const STUNDEN_GRENZEN: Record<string, number> = {
  '10/2': 320,
  '11/1': 600, '11/2': 600,
  '12/1': 880, '12/2': 880,
  '13/1': 1020,
}

function getRelevanteLernfelder(
  beruf: Beruf,
  semester: string
): { lf: string; stunden: number }[] {
  const maxStunden = STUNDEN_GRENZEN[semester] ?? Infinity
  const result: { lf: string; stunden: number }[] = []
  let cumulative = 0

  for (const lf of LERNFELDER) {
    const stunden = beruf.lernfelder.get(lf) ?? 0
    if (stunden === 0) continue
    cumulative += stunden
    if (cumulative > maxStunden) break
    result.push({ lf, stunden })
  }
  return result
}

// ── Extended Note Prompt ─────────────────────────────────────────────────────

type NoteResult = { note: number | null; action: 'note' | 'all-4' | 'skip' | 'back' }

async function promptNoteExtended(
  label: string,
  lastNote: number | null,
  showQuickOptions: boolean
): Promise<NoteResult | symbol> {
  if (showQuickOptions) {
    const choice = await p.select({
      message: label,
      options: [
        { value: '__note__', label: 'Note eingeben' },
        { value: '__all4__', label: '→ Alle verbleibenden auf 4' },
        { value: '__skip__', label: '→ Nicht unterrichtet' },
        { value: '__back__', label: '← Zurück' },
      ]
    })

    if (p.isCancel(choice)) return choice as symbol

    if (choice === '__all4__') return { note: 4, action: 'all-4' }
    if (choice === '__skip__') return { note: null, action: 'skip' }
    if (choice === '__back__') return { note: null, action: 'back' }
  }

  const defaultVal = lastNote !== null ? String(lastNote) : '4'
  const input = await p.text({
    message: label,
    initialValue: defaultVal,
    validate: (v) => {
      const n = parseInt(v?.trim() ?? '', 10)
      if (isNaN(n) || n < 0 || n > 6) return 'Gültig: 1–6 (oder 0 = nicht unterrichtet)'
    }
  })

  if (p.isCancel(input)) return input as symbol
  const n = parseInt((input as string).trim(), 10)
  return { note: n === 0 ? null : n, action: 'note' }
}

// ── Draft Helpers ───────────────────────────────────────────────────────────

function createDraft(state: SessionState): EinzelfallDraft {
  return {
    id: state.draftId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schueler: state.schueler,
    lastNote: state.lastNote,
    currentStep: state.currentStep === 'done' ? 'name' : state.currentStep,
    berufName: state.berufName,
    halbjahre: state.halbjahre,
    lfStundenOverrides: Object.fromEntries(state.lfStundenOverrides),
    halbjahrStundenOverrides: state.halbjahrStundenOverrides,
  }
}

function persistDraft(state: SessionState): void {
  if (state.draftId) {
    saveEinzefallDraft(createDraft(state))
    state.isDirty = false
  }
}

// ── Validation ───────────────────────────────────────────────────────────────

interface ValidationWarning {
  field: string
  message: string
}

function validateSchuelerData(state: SessionState, berufName: string | null, berufeLoader: BerufeLoader): ValidationWarning[] {
  const warnings: ValidationWarning[] = []
  const s = state.schueler

  // Name-Format-Warnung
  const fullName = `${s.nachname ?? ''}, ${s.vorname ?? ''}`
  if (!s.nachname || !s.vorname || !fullName.match(/^[A-ZÄÖÜ].+,\s*[A-ZÄÖÜ].+$/)) {
    warnings.push({ field: 'name', message: `Name "${fullName}" — Format "Nachname, Vorname" erwartet` })
  }

  const lernfelder = s.noten?.lernfelder
  if (lernfelder && berufName) {
    const beruf = berufeLoader.getBeruf(berufName)
    let hasAnyBBU = false
    for (const [lf, eintraege] of lernfelder) {
      const stunden = beruf?.lernfelder.get(lf) ?? 0
      if (stunden > 0) {
        const note = [...eintraege].reverse().find(n => n.note !== null)?.note
        if (note !== null && note !== undefined) hasAnyBBU = true
      }
    }
    if (!hasAnyBBU) {
      warnings.push({ field: 'bbu', message: 'Keine BBU-Noten eingegeben' })
    }
  }

  // Fächer ohne Noten
  const allgFaecher = s.noten?.allgemeineFaecher
  if (allgFaecher) {
    for (const fach of ALLGEMEINE_FAECHER) {
      const noten = allgFaecher.get(fach) ?? []
      const hasNote = noten.some(n => n.note !== null && n.note !== undefined && n.note > 0)
      if (!hasNote) {
        warnings.push({ field: fach, message: `${FACH_NAMEN[fach] ?? fach} hat keine Noten` })
      }
    }
  }

  return warnings
}

// ── Preview Screen ───────────────────────────────────────────────────────────

function showPreviewScreen(
  state: SessionState,
  ergebnis: ReturnType<typeof calculateSchuelerNoten>,
  berufName: string,
  berufeLoader: BerufeLoader
): void {
  console.clear()
  p.intro('📋 Vorschau — ' + (state.schueler.nachname ?? '') + ', ' + (state.schueler.vorname ?? ''))

  const lines: string[] = []

  lines.push(`Klasse:   ${state.schueler.klasse ?? '–'}`)
  lines.push(`Beruf:    ${berufName}`)
  lines.push(`Semester: ${state.halbjahre.join(', ')}`)
  lines.push('')
  lines.push('─'.repeat(50))
  lines.push('BBU (Lernfelder):')

  const berufData = berufeLoader.getBeruf(berufName)
  if (berufData) {
    const relevanteLFs = getRelevanteLernfelder(berufData, state.schueler.stufeSemester ?? '13/1')
    for (const { lf, stunden: origStunden } of relevanteLFs) {
      const displayStunden = state.lfStundenOverrides.get(lf) ?? origStunden
      const isOverridden = state.lfStundenOverrides.has(lf)
      const eintraege = state.schueler.noten?.lernfelder?.get(lf) ?? []
      const note = [...eintraege].reverse().find(n => n.note !== null)?.note ?? '–'
      const punkte = typeof note === 'number' ? ` → ${note * displayStunden} Pkt.` : ''
      lines.push(`  ${lf} (${displayStunden}h${isOverridden ? '*' : ''}): ${note}${punkte}`)
    }
  }

  lines.push('')
  lines.push(`BBU-Rohnote:   ${ergebnis.bbuNote.toFixed(2)} → gerundet: ${ergebnis.bbuNoteGerundet}`)
  lines.push('')
  lines.push('─'.repeat(50))
  lines.push('Allgemeine Fächer:')

  for (const fach of ALLGEMEINE_FAECHER) {
    const notenListe = state.schueler.noten?.allgemeineFaecher?.get(fach) ?? []
    const hjTeile: string[] = []
    for (let i = 0; i < state.halbjahre.length; i++) {
      const hj = state.halbjahre[i]!
      const note = notenListe[i]?.note
      hjTeile.push(`${hj}: ${note ?? '–'}`)
    }
    const fachErgebnis = ergebnis.allgemeineFaecherNoten.get(fach)
    const endnote = fachErgebnis && fachErgebnis.note > 0 ? fachErgebnis.note.toFixed(2) : '–'
    lines.push(`  ${(FACH_NAMEN[fach] ?? fach).padEnd(22)} ${hjTeile.join(' | ')}  → ${endnote}`)
  }

  lines.push('')
  lines.push('─'.repeat(50))
  lines.push(`Gesamtnote:     ${ergebnis.gesamtnote.toFixed(2)} (2 NKS abgerundet)`)
  lines.push(`Gewichtung BBU: ${ergebnis.gewichtungBBU.toFixed(2)}  Gewichtung Allg: ${ergebnis.gewichtungAllg.toFixed(2)}`)

  p.note(lines.join('\n'), 'Berechnungsvorschau')
}

// ── Before/After Comparison ─────────────────────────────────────────────────

interface GradeChangeResult {
  field: string
  hjIndex?: number
  oldNote: number | null
  newNote: number | null
  ergebnisBefore: ReturnType<typeof calculateSchuelerNoten>
  ergebnisAfter: ReturnType<typeof calculateSchuelerNoten>
}

function showBeforeAfter(change: GradeChangeResult): void {
  const lines: string[] = []

  const fieldLabel = FACH_NAMEN[change.field] ?? change.field
  lines.push(`Feld: ${fieldLabel}`)
  lines.push(`Änderung: ${change.oldNote ?? '–'} → ${change.newNote ?? '–'}`)
  lines.push('')
  lines.push('Auswirkung:')
  lines.push(`  BBU-Note:     ${change.ergebnisBefore.bbuNote.toFixed(2)} → ${change.ergebnisAfter.bbuNote.toFixed(2)}  (gerundet: ${change.ergebnisBefore.bbuNoteGerundet} → ${change.ergebnisAfter.bbuNoteGerundet})`)
  lines.push(`  Gesamtnote:   ${change.ergebnisBefore.gesamtnote.toFixed(2)} → ${change.ergebnisAfter.gesamtnote.toFixed(2)}  (gerundet: ${change.ergebnisBefore.gesamtnoteGerundet} → ${change.ergebnisAfter.gesamtnoteGerundet})`)

  p.note(lines.join('\n'), 'Vorher / Nachher')
}

// ── Undo Apply ──────────────────────────────────────────────────────────────

function applyUndo(state: SessionState): boolean {
  const entry = state.undoStack.pop()
  if (!entry) return false

  const isAllgFach = ALLGEMEINE_FAECHER.includes(entry.field as typeof ALLGEMEINE_FAECHER[number])

  if (isAllgFach) {
    const allgemeineFaecher = new Map(state.schueler.noten?.allgemeineFaecher ?? new Map())
    const noten = [...(allgemeineFaecher.get(entry.field) || [])]
    const idx = entry.hjIndex ?? 0
    noten[idx] = { note: entry.oldNote, lehrer: '' }
    allgemeineFaecher.set(entry.field, noten)
    state.schueler.noten = { ...state.schueler.noten!, allgemeineFaecher }
  } else {
    const lernfelder = new Map(state.schueler.noten?.lernfelder ?? new Map())
    lernfelder.set(entry.field, [{ note: entry.oldNote, lehrer: '' }])
    state.schueler.noten = { ...state.schueler.noten!, lernfelder }
  }

  state.isDirty = true
  const fieldLabel = FACH_NAMEN[entry.field] ?? entry.field
  p.log.info(`Rückgängig: ${fieldLabel} ${entry.newNote ?? '–'} → ${entry.oldNote ?? '–'}`)
  return true
}

// ── PDF Export ─────────────────────────────────────────────────────────────

async function handlePDFExport(
  schueler: Schueler,
  ergebnis: ReturnType<typeof calculateSchuelerNoten>,
  berufName: string,
  berufeLoader: BerufeLoader,
  halbjahrStunden: Record<string, number>,
  draftId: string | null
): Promise<boolean> {
  const now = new Date()
  const dateStr = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}_${String(now.getDate()).padStart(2, '0')}`
  const filename = `${dateStr}_${schueler.klasse}_${schueler.nachname}.pdf`
  const outputDir = OUTPUT_DIR
  const outputPath = path.join(outputDir, filename)

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  let finalPath = outputPath

  if (fs.existsSync(outputPath)) {
    const overwrite = await p.select({
      message: `PDF existiert bereits: ${filename}`,
      options: [
        { value: 'overwrite', label: 'Überschreiben' },
        { value: 'rename', label: 'Neuen Namen wählen' },
        { value: 'cancel', label: 'Abbrechen' },
      ]
    })

    if (p.isCancel(overwrite) || overwrite === 'cancel') return false

    if (overwrite === 'rename') {
      const newName = await p.text({
        message: 'Neuer Dateiname:',
        initialValue: filename,
      })
      if (p.isCancel(newName)) return false
      finalPath = path.join(outputDir, newName as string)
    }
  }

  try {
    await generatePDF([ergebnis], finalPath, {
      beruf: berufeLoader.getBeruf(berufName)!,
      halbjahre: schueler.halbjahre ?? [],
      halbjahrStunden,
    })
    p.log.success(`PDF gespeichert: ${finalPath}`)

    if (draftId) {
      deleteEinzefallDraft(draftId)
    }

    return true
  } catch (error) {
    p.log.error(`Fehler beim PDF-Export: ${error}`)
    return false
  }
}

// ── Step Handlers ────────────────────────────────────────────────────────────

async function stepName(state: SessionState): Promise<EinzelfallStep | 'done'> {
  const name = await p.text({
    message: 'Name des Schülers',
    placeholder: 'Nachname, Vorname',
    initialValue: state.schueler.nachname && state.schueler.vorname
      ? `${state.schueler.nachname}, ${state.schueler.vorname}`
      : '',
    validate: (v) => {
      if (!v?.trim()) return 'Name ist erforderlich'
      if (!v.includes(',')) return 'Format: Nachname, Vorname'
    }
  })

  if (p.isCancel(name)) return 'done'

  const parts = (name as string).split(',')
  state.schueler.nachname = parts[0]?.trim() || ''
  state.schueler.vorname = parts[1]?.trim() || ''
  state.isDirty = true
  persistDraft(state)
  return 'klasse'
}

async function stepKlasse(state: SessionState): Promise<EinzelfallStep | 'done'> {
  const klasse = await p.text({
    message: 'Klasse',
    placeholder: 'z.B. 11B501',
    initialValue: state.schueler.klasse ?? '',
    validate: (v) => v?.trim() ? undefined : 'Klasse ist erforderlich'
  })

  if (p.isCancel(klasse)) return 'name'
  state.schueler.klasse = klasse as string
  state.isDirty = true
  persistDraft(state)
  return 'semester'
}

async function stepSemester(state: SessionState): Promise<EinzelfallStep | 'done'> {
  const currentSemester = state.schueler.stufeSemester || undefined
  const semesterOptions = ALL_HJ.map(hj => {
    const hjList = ALL_HJ.slice(0, ALL_HJ.indexOf(hj) + 1).join(', ')
    return { value: hj, label: hj, hint: `Halbjahre: ${hjList}` }
  })

  const stufeSemester = await p.select({
    message: 'Ausscheide-Semester',
    initialValue: currentSemester,
    options: semesterOptions,
  })

  if (p.isCancel(stufeSemester)) return 'klasse'
  state.schueler.stufeSemester = stufeSemester as string
  state.halbjahre = ALL_HJ.slice(0, ALL_HJ.indexOf(stufeSemester as string) + 1)
  state.isDirty = true
  persistDraft(state)
  return 'beruf'
}

async function stepBeruf(state: SessionState, berufeLoader: BerufeLoader): Promise<EinzelfallStep | 'done'> {
  const berufName = await selectBerufWithSearch(berufeLoader, state.berufName ?? undefined)
  if (!berufName) return 'semester'

  state.berufName = berufName
  state.schueler.beruf = berufName
  state.isDirty = true
  persistDraft(state)

  const berufData = berufeLoader.getBeruf(berufName)
  if (berufData && state.schueler.stufeSemester) {
    const relevante = getRelevanteLernfelder(berufData, state.schueler.stufeSemester)
    const lfInfo = relevante.map(({ lf, stunden }) => `${lf}=${stunden}`).join(', ')
    p.log.info(`Lernfelder für ${state.schueler.stufeSemester}: ${lfInfo}`)
  }

  return 'lernfelder'
}

async function stepLernfelder(
  state: SessionState,
  berufeLoader: BerufeLoader
): Promise<EinzelfallStep | 'done'> {
  if (!state.berufName) return 'beruf'

  const berufData = berufeLoader.getBeruf(state.berufName)
  if (!berufData) return 'beruf'

  p.log.step('Noten der Lernfelder eingeben')

  const lernfeldNoten = state.schueler.noten?.lernfelder ?? new Map()
  const relevanteLFs = getRelevanteLernfelder(berufData, state.schueler.stufeSemester ?? '13/1')

  for (let i = 0; i < relevanteLFs.length; i++) {
    const { lf, stunden } = relevanteLFs[i]!

    const currentEintraege = lernfeldNoten.get(lf) ?? []
    const currentNote = [...currentEintraege].reverse().find(n => n.note !== null)?.note ?? null
    const initialNote = currentNote ?? state.lastNote ?? 3

    const result = await promptNoteScale(`${lf} (${stunden}h)`, initialNote, { current: i + 1, total: relevanteLFs.length })

    if (result.action === 'back') {
      if (i === 0) return 'beruf'
      // Go back to previous LF
      i -= 2
      continue
    }

    lernfeldNoten.set(lf, [{ note: result.note, lehrer: '' }])
    if (result.note !== null) state.lastNote = result.note
    state.isDirty = true
  }

  state.schueler.noten = { ...state.schueler.noten!, lernfelder: lernfeldNoten }
  persistDraft(state)
  return 'allgFaecher'
}

async function stepAllgFaecher(
  state: SessionState,
  halbjahrStunden: Record<string, number>
): Promise<EinzelfallStep | 'done'> {
  p.log.step('Noten allgemeine Fächer')

  const allgFachNoten = state.schueler.noten?.allgemeineFaecher ?? new Map()

  if (state.halbjahre.length === 0) {
    for (const fach of ALLGEMEINE_FAECHER) {
      allgFachNoten.set(fach, [{ note: null, lehrer: '' }])
    }
    state.schueler.noten = { ...state.schueler.noten!, allgemeineFaecher: allgFachNoten }
    persistDraft(state)
    return 'preview'
  }

  // Build flat list of (fach, hjIndex) pairs for linear navigation with back
  const entries: { fach: string; fachName: string; hjIndex: number; hj: string; stunden: number }[] = []
  for (const fach of ALLGEMEINE_FAECHER) {
    const fachName = FACH_NAMEN[fach] || fach
    for (let i = 0; i < state.halbjahre.length; i++) {
      const hj = state.halbjahre[i]!
      const stunden = halbjahrStunden[hj] ?? 0
      entries.push({ fach, fachName, hjIndex: i, hj, stunden })
    }
  }

  // Track notes per fach as we go
  const tempNoten: Map<string, NoteEintrag[]> = new Map()
  for (const fach of ALLGEMEINE_FAECHER) {
    tempNoten.set(fach, [...(allgFachNoten.get(fach) ?? [])])
  }

  for (let idx = 0; idx < entries.length; idx++) {
    const { fach, fachName, hjIndex, hj, stunden } = entries[idx]!

    const currentNoten = tempNoten.get(fach) ?? []
    const currentNote = currentNoten[hjIndex]?.note ?? null
    const initialNote = currentNote ?? state.lastNote ?? 3

    const result = await promptNoteScale(`${fachName} in ${hj} (${stunden}h)`, initialNote, { current: idx + 1, total: entries.length })

    if (result.action === 'back') {
      if (idx === 0) return 'lernfelder'
      idx -= 2
      continue
    }

    // Set the note at the right position
    const noten = tempNoten.get(fach) ?? []
    while (noten.length <= hjIndex) noten.push({ note: null, lehrer: '' })
    noten[hjIndex] = { note: result.note, lehrer: '' }
    tempNoten.set(fach, noten)

    if (result.note !== null) state.lastNote = result.note
    state.isDirty = true
  }

  for (const [fach, noten] of tempNoten) {
    allgFachNoten.set(fach, noten)
  }

  state.schueler.noten = { ...state.schueler.noten!, allgemeineFaecher: allgFachNoten }
  persistDraft(state)
  return 'preview'
}

// ── Stunden-Edit ────────────────────────────────────────────────────────────

async function editStunden(
  state: SessionState,
  beruf: Beruf,
  halbjahrStunden: Record<string, number>
): Promise<boolean> {
  const choice = await p.select({
    message: 'Welche Stunden bearbeiten?',
    options: [
      { value: 'lf', label: 'Lernfeld-Stunden (BBU)' },
      { value: 'hj', label: 'Halbjahr-Stunden (allg. Fächer)' },
      { value: 'back', label: '← Zurück' },
    ]
  })
  if (p.isCancel(choice) || choice === 'back') return false

  if (choice === 'lf') {
    const relevante = getRelevanteLernfelder(beruf, state.schueler.stufeSemester ?? '13/1')
    for (const { lf, stunden } of relevante) {
      const currentOverride = state.lfStundenOverrides.get(lf)
      const input = await p.text({
        message: `${lf} Stunden`,
        initialValue: String(currentOverride ?? stunden),
        validate: v => { const n = parseInt(v?.trim() ?? '', 10); if (isNaN(n) || n < 0) return 'Zahl >= 0 erforderlich' }
      })
      if (p.isCancel(input)) return false
      const val = parseInt((input as string).trim(), 10)
      if (val !== stunden) {
        state.lfStundenOverrides.set(lf, val)
      } else {
        state.lfStundenOverrides.delete(lf)
      }
    }
    state.isDirty = true
    persistDraft(state)
    return true
  }

  if (choice === 'hj') {
    for (const hj of state.halbjahre) {
      const defaultStunden = halbjahrStunden[hj] ?? 0
      const currentOverride = state.halbjahrStundenOverrides[hj]
      const input = await p.text({
        message: `${hj} Stunden`,
        initialValue: String(currentOverride ?? defaultStunden),
        validate: v => { const n = parseInt(v?.trim() ?? '', 10); if (isNaN(n) || n < 0) return 'Zahl >= 0 erforderlich' }
      })
      if (p.isCancel(input)) return false
      const val = parseInt((input as string).trim(), 10)
      if (val !== defaultStunden) {
        state.halbjahrStundenOverrides[hj] = val
      } else {
        delete state.halbjahrStundenOverrides[hj]
      }
    }
    state.isDirty = true
    persistDraft(state)
    return true
  }

  return false
}

async function stepPreview(
  state: SessionState,
  berufeLoader: BerufeLoader,
  halbjahrStunden: Record<string, number>
): Promise<EinzelfallStep | 'done'> {
  if (!state.berufName) return 'beruf'

  const berufData = berufeLoader.getBeruf(state.berufName)
  if (!berufData) return 'beruf'

  const schueler = buildSchueler(state)
  const ergebnis = calculateSchuelerNoten(schueler, berufData, state.halbjahre, { ...halbjahrStunden, ...state.halbjahrStundenOverrides }, state.lfStundenOverrides)

  const warnings = validateSchuelerData(state, state.berufName, berufeLoader)
  if (warnings.length > 0) {
    for (const w of warnings) p.log.warn(w.message)
  }

  showPreviewScreen(state, ergebnis, state.berufName, berufeLoader)

  const options: { value: string; label: string }[] = [
    { value: 'berechnen', label: '✅ Berechnen & Ergebnis anzeigen' },
    { value: 'edit_lf', label: '📝 Lernfelder-Noten ändern' },
    { value: 'edit_allg', label: '📝 Allg. Fächer-Noten ändern' },
    { value: 'edit_data', label: '✏️  Schüler-Daten ändern' },
    { value: 'edit_beruf', label: '🎓 Beruf ändern' },
    { value: 'edit_stunden', label: '⏱️  Stunden bearbeiten', },
    { value: 'cancel', label: '✕ Abbrechen' },
  ]

  const action = await p.select({ message: 'Was möchtest du tun?', options })

  if (p.isCancel(action) || action === 'cancel') return 'done'

  if (action === 'edit_lf') return 'lernfelder'
  if (action === 'edit_allg') return 'allgFaecher'
  if (action === 'edit_beruf') return 'beruf'
  if (action === 'edit_data') {
    const edited = await editStudentData(state)
    return edited ? 'preview' : 'preview'
  }
  if (action === 'edit_stunden') {
    const berufData = berufeLoader.getBeruf(state.berufName!)!
    await editStunden(state, berufData, halbjahrStunden)
    return 'preview'
  }

  return 'ergebnis'
}

// ── Edit Student Data ────────────────────────────────────────────────────────

async function editStudentData(state: SessionState): Promise<boolean> {
  const field = await p.select({
    message: 'Was ändern?',
    options: [
      { value: 'name', label: `Name: ${state.schueler.nachname ?? '–'}, ${state.schueler.vorname ?? '–'}` },
      { value: 'klasse', label: `Klasse: ${state.schueler.klasse ?? '–'}` },
      { value: 'semester', label: `Semester: ${state.schueler.stufeSemester ?? '–'}` },
      { value: 'back', label: '← Zurück' },
    ]
  })

  if (p.isCancel(field) || field === 'back') return false

  if (field === 'name') {
    const name = await p.text({
      message: 'Neuer Name',
      placeholder: 'Nachname, Vorname',
      initialValue: `${state.schueler.nachname ?? ''}, ${state.schueler.vorname ?? ''}`,
      validate: (v) => {
        if (!v?.trim()) return 'Name ist erforderlich'
        if (!v.includes(',')) return 'Format: Nachname, Vorname'
      }
    })
    if (p.isCancel(name)) return false
    const parts = (name as string).split(',')
    state.schueler.nachname = parts[0]?.trim() || ''
    state.schueler.vorname = parts[1]?.trim() || ''
    state.isDirty = true
    persistDraft(state)
    return true
  }

  if (field === 'klasse') {
    const klasse = await p.text({
      message: 'Neue Klasse',
      initialValue: state.schueler.klasse ?? '',
      validate: (v) => v?.trim() ? undefined : 'Klasse ist erforderlich'
    })
    if (p.isCancel(klasse)) return false
    state.schueler.klasse = klasse as string
    state.isDirty = true
    persistDraft(state)
    return true
  }

  if (field === 'semester') {
    const semester = await p.select({
      message: 'Neues Ausscheide-Semester',
      initialValue: state.schueler.stufeSemester || undefined,
      options: [
        { value: '10/2', label: '10/2' },
        { value: '11/1', label: '11/1' },
        { value: '11/2', label: '11/2' },
        { value: '12/1', label: '12/1' },
        { value: '12/2', label: '12/2' },
        { value: '13/1', label: '13/1' },
      ]
    })
    if (p.isCancel(semester)) return false
    state.schueler.stufeSemester = semester as string
    state.halbjahre = ALL_HJ.slice(0, ALL_HJ.indexOf(semester as string) + 1)
    state.isDirty = true
    persistDraft(state)
    p.log.info(`Semester geändert → Halbjahre: ${state.halbjahre.join(', ')}`)
    return true
  }

  return false
}

// ── Step Ergebnis ────────────────────────────────────────────────────────────

async function stepErgebnis(
  state: SessionState,
  berufeLoader: BerufeLoader,
  halbjahrStunden: Record<string, number>
): Promise<EinzelfallStep | 'done'> {
  if (!state.berufName) return 'beruf'

  const berufData = berufeLoader.getBeruf(state.berufName)
  if (!berufData) return 'beruf'

  const schueler = buildSchueler(state)
  const ergebnis = calculateSchuelerNoten(schueler, berufData, state.halbjahre, { ...halbjahrStunden, ...state.halbjahrStundenOverrides }, state.lfStundenOverrides)

  console.clear()
  p.intro('📊 Berechnungsergebnis')

  // BBU-Aufschlüsselung
  const bbuLines: string[] = []
  for (const lf of LERNFELDER) {
    const stunden = berufData.lernfelder.get(lf) ?? 0
    if (stunden === 0) continue
    const eintraege = schueler.noten.lernfelder.get(lf) || []
    const note = [...eintraege].reverse().find(n => n.note !== null && n.note! > 0)?.note
    if (note) {
      bbuLines.push(`  ${lf}: ${note} × ${stunden}h = ${note * stunden}`)
    }
  }

  // Allg. Fächer
  const allgLines: string[] = []
  for (const fach of ALLGEMEINE_FAECHER) {
    const fachName = FACH_NAMEN[fach] || fach
    const notenListe = schueler.noten.allgemeineFaecher.get(fach) || []
    const hjTeile: string[] = []
    let hasAny = false
    for (let i = 0; i < state.halbjahre.length; i++) {
      const hj = state.halbjahre[i]!
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
      `Name:          ${ergebnis.schueler.nachname}, ${ergebnis.schueler.vorname}`,
      `Klasse:        ${ergebnis.schueler.klasse}`,
      `Beruf:         ${ergebnis.schueler.beruf}`,
      `${'─'.repeat(50)}`,
      'BBU-Aufschlüsselung:',
      ...bbuLines,
      `  Σ = ${ergebnis.gewichtungBBU.toFixed(0)} / ${ergebnis.stundenBBU}h = ${ergebnis.bbuNote.toFixed(2)}`,
      `BBU-Note:      ${ergebnis.bbuNote.toFixed(2)}  →  gerundet: ${ergebnis.bbuNoteGerundet}`,
      `${'─'.repeat(50)}`,
      'Allgemeine Fächer:',
      ...allgLines,
      `${'─'.repeat(50)}`,
      `Stunden BBU:    ${ergebnis.stundenBBU}      Stunden Allg.: ${ergebnis.stundenAllg}`,
      `Gewichtung BBU: ${ergebnis.gewichtungBBU.toFixed(0)}    Gewichtung Allg: ${ergebnis.gewichtungAllg.toFixed(0)}`,
      `${'─'.repeat(50)}`,
      `Gesamtnote:    ${ergebnis.gesamtnote.toFixed(2)}  (abgerundet, 2 NKS)`,
      `Formel: (${ergebnis.gewichtungBBU.toFixed(0)} + ${ergebnis.gewichtungAllg.toFixed(0)}) / (${ergebnis.stundenBBU} + ${ergebnis.stundenAllg}) = ${ergebnis.gesamtnote.toFixed(4)}`,
    ].join('\n'),
    `${ergebnis.schueler.nachname}, ${ergebnis.schueler.vorname}`
  )

  // Menü-Optionen dynamisch aufbauen
  const options: { value: string; label: string; hint?: string }[] = [
    { value: 'pdf', label: '📄 PDF exportieren', hint: `Speichert als ${new Date().getFullYear()}_…_Klasse_Name.pdf` },
    { value: 'note', label: '📝 Note ändern', hint: 'Einzelne Note korrigieren mit Vorher/Nachher-Vergleich' },
  ]
  if (state.undoStack.size > 0) {
    const last = state.undoStack.getAll().at(-1)!
    const label = FACH_NAMEN[last.field] ?? last.field
    options.push({ value: 'undo', label: `↩️  Rückgängig: ${label} ${last.newNote ?? '–'} → ${last.oldNote ?? '–'}` })
  }
  options.push(
    { value: 'edit_data', label: '✏️  Schüler-Daten ändern' },
    { value: 'edit_stunden', label: '⏱️  Stunden bearbeiten' },
    { value: 'beruf', label: '🎓 Beruf ändern' },
    { value: 'back', label: '← Zurück zur Vorschau' },
  )

  const action = await p.select({ message: 'Was möchtest du tun?', options })

  if (p.isCancel(action) || action === 'back') return 'preview'

  if (action === 'pdf') {
    const success = await handlePDFExport(schueler, ergebnis, state.berufName, berufeLoader, halbjahrStunden, state.draftId)
    if (success) return 'done'
    return 'ergebnis'
  }

  if (action === 'beruf') return 'beruf'

  if (action === 'undo') {
    applyUndo(state)
    persistDraft(state)
    return 'ergebnis'
  }

  if (action === 'edit_data') {
    await editStudentData(state)
    return 'ergebnis'
  }

  if (action === 'edit_stunden') {
    await editStunden(state, berufData, halbjahrStunden)
    return 'ergebnis'
  }

  if (action === 'note') {
    return await editNote(state, schueler, ergebnis, berufData, halbjahrStunden)
  }

  return 'ergebnis'
}

// ── Note Edit (extracted from stepErgebnis) ─────────────────────────────────

async function editNote(
  state: SessionState,
  schueler: Schueler,
  ergebnis: ReturnType<typeof calculateSchuelerNoten>,
  berufData: Beruf,
  halbjahrStunden: Record<string, number>
): Promise<EinzelfallStep | 'done'> {
  const fachOptions: { value: string; label: string; hint?: string }[] = []

  for (const [lf, eintraege] of schueler.noten.lernfelder) {
    const stunden = berufData.lernfelder.get(lf) ?? 0
    if (stunden === 0) continue
    const note = [...eintraege].reverse().find(n => n.note !== null)?.note ?? null
    fachOptions.push({ value: lf, label: `${lf} (${stunden}h)`, hint: note !== null ? String(note) : '–' })
  }

  for (const fach of ALLGEMEINE_FAECHER) {
    const fachErgebnis = ergebnis.allgemeineFaecherNoten.get(fach)
    const endnote = fachErgebnis && fachErgebnis.note > 0 ? fachErgebnis.note.toFixed(2) : '–'
    fachOptions.push({ value: fach, label: FACH_NAMEN[fach] ?? fach, hint: endnote })
  }

  fachOptions.push({ value: '__back__', label: '← Zurück' })

  const fach = await p.select({ message: 'Welches Fach / Lernfeld?', options: fachOptions })
  if (p.isCancel(fach) || fach === '__back__') return 'ergebnis'

  const isAllgFach = ALLGEMEINE_FAECHER.includes(fach as typeof ALLGEMEINE_FAECHER[number])
  const ergebnisBefore = ergebnis
  let newNote: number | null = null
  let hjIdx: number | undefined
  let oldNote: number | null = null

  if (isAllgFach && state.halbjahre.length > 1) {
    const currentNoten = schueler.noten.allgemeineFaecher.get(fach as string) || []
    const hjOptions = state.halbjahre.map((hj, i) => {
      const note = currentNoten[i]?.note
      return { value: hj, label: hj, hint: note !== null && note !== undefined ? String(note) : '–' }
    })
    hjOptions.push({ value: '__back__', label: '← Zurück', hint: '' })

    const hjSelection = await p.select({ message: `Welches Halbjahr für ${FACH_NAMEN[fach as string] ?? fach}?`, options: hjOptions })
    if (p.isCancel(hjSelection) || hjSelection === '__back__') return 'ergebnis'

    hjIdx = state.halbjahre.indexOf(hjSelection as string)
    oldNote = currentNoten[hjIdx]?.note ?? null

    const result = await promptNoteExtended(`Neue Note für ${FACH_NAMEN[fach as string] ?? fach} in ${hjSelection}`, oldNote, false)
    if (p.isCancel(result) || typeof result === 'symbol') return 'ergebnis'
    newNote = result.note

    const allgemeineFaecher = new Map(schueler.noten.allgemeineFaecher)
    const updatedNoten = [...(allgemeineFaecher.get(fach as string) || [])]
    updatedNoten[hjIdx] = { note: newNote, lehrer: '' }
    allgemeineFaecher.set(fach as string, updatedNoten)
    state.schueler.noten = { ...state.schueler.noten!, allgemeineFaecher }
  } else if (isAllgFach) {
    oldNote = schueler.noten.allgemeineFaecher.get(fach as string)?.[0]?.note ?? null

    const result = await promptNoteExtended(`Neue Note für ${FACH_NAMEN[fach as string] ?? fach}`, oldNote, false)
    if (p.isCancel(result) || typeof result === 'symbol') return 'ergebnis'
    newNote = result.note

    const allgemeineFaecher = new Map(schueler.noten.allgemeineFaecher)
    allgemeineFaecher.set(fach as string, [{ note: newNote, lehrer: '' }])
    state.schueler.noten = { ...state.schueler.noten!, allgemeineFaecher }
  } else {
    const lernfelder = new Map(schueler.noten.lernfelder)
    oldNote = [...(lernfelder.get(fach as string) || [])].reverse().find(n => n.note !== null)?.note ?? null

    const result = await promptNoteExtended(`Neue Note für ${fach}`, oldNote, false)
    if (p.isCancel(result) || typeof result === 'symbol') return 'ergebnis'
    newNote = result.note

    lernfelder.set(fach as string, [{ note: newNote, lehrer: '' }])
    state.schueler.noten = { ...state.schueler.noten!, lernfelder }
  }

  const schuelerAfter = buildSchueler(state)
  const ergebnisAfter = calculateSchuelerNoten(schuelerAfter, berufData, state.halbjahre, halbjahrStunden)

  showBeforeAfter({
    field: fach as string,
    hjIndex: hjIdx,
    oldNote,
    newNote,
    ergebnisBefore,
    ergebnisAfter,
  })

  state.undoStack.push({ field: fach as string, hjIndex: hjIdx, oldNote, newNote })
  state.isDirty = true
  persistDraft(state)

  return 'ergebnis'
}

// ── Draft Resume ─────────────────────────────────────────────────────────────

function resumeDraft(draft: EinzelfallDraft): SessionState {
  return {
    draftId: draft.id,
    currentStep: draft.currentStep,
    schueler: draft.schueler,
    berufName: draft.berufName,
    halbjahre: draft.halbjahre,
    lastNote: draft.lastNote,
    undoStack: new UndoStack(),
    isDirty: false,
    lfStundenOverrides: new Map(Object.entries(draft.lfStundenOverrides ?? {})),
    halbjahrStundenOverrides: { ...(draft.halbjahrStundenOverrides ?? {}) },
  }
}

// ── State Machine ─────────────────────────────────────────────────────────────

async function runStateMachine(
  state: SessionState,
  berufeLoader: BerufeLoader,
  einstellungen: Einstellungen
): Promise<void> {
  const halbjahrStunden = einstellungen.halbjahrStunden as Record<string, number>

  while (state.currentStep !== 'done') {
    if (einstellungen.tutorialTipps && STEP_TIPS[state.currentStep]) {
      p.log.message('\x1b[2m💡 ' + STEP_TIPS[state.currentStep] + '\x1b[0m')
    }

    let nextStep: EinzelfallStep | 'done' = 'done'

    switch (state.currentStep) {
      case 'name':
        nextStep = await stepName(state)
        break
      case 'klasse':
        nextStep = await stepKlasse(state)
        break
      case 'semester':
        nextStep = await stepSemester(state)
        break
      case 'beruf':
        nextStep = await stepBeruf(state, berufeLoader)
        break
      case 'lernfelder':
        nextStep = await stepLernfelder(state, berufeLoader)
        break
      case 'allgFaecher':
        nextStep = await stepAllgFaecher(state, halbjahrStunden)
        break
      case 'preview':
        nextStep = await stepPreview(state, berufeLoader, halbjahrStunden)
        break
      case 'ergebnis':
        nextStep = await stepErgebnis(state, berufeLoader, halbjahrStunden)
        break
    }

    if (p.isCancel(nextStep)) {
      if (state.isDirty) {
        const save = await p.select({
          message: 'Entwurf speichern?',
          options: [
            { value: 'save', label: 'Ja, speichern' },
            { value: 'discard', label: 'Nein, verwerfen' },
          ]
        })
        if (!p.isCancel(save) && save === 'save') {
          persistDraft(state)
          p.log.info('Entwurf gespeichert.')
        }
      }
      return
    }

    state.currentStep = nextStep as EinzelfallStep | 'done'
  }
}

// ── Main Entry Point ─────────────────────────────────────────────────────────

export async function einzelfallBerechnung(berufeLoader: BerufeLoader, einstellungen: Einstellungen) {
  console.clear()
  p.intro('📝 Einzelfallberechnung (Abgangszeugnis)')

  const drafts = loadEinzelfallDrafts()

  if (drafts.length > 0) {
    const resume = await p.select({
      message: `Es gibt ${drafts.length} gespeicherte(n) Entwurf/Entwürfe. Fortsetzen?`,
      options: [
        { value: 'resume', label: 'Entwurf fortsetzen' },
        { value: 'new', label: 'Neu anfangen' },
        { value: 'cancel', label: 'Abbrechen' },
      ]
    })

    if (p.isCancel(resume) || resume === 'cancel') return

    if (resume === 'resume') {
      const draftOptions = drafts.map(d => ({
        value: d.id,
        label: `${d.schueler.nachname ?? '–'}, ${d.schueler.vorname ?? '–'} (${d.currentStep})`,
        hint: new Date(d.updatedAt).toLocaleString('de-DE'),
      }))
      draftOptions.push({ value: '__new__', label: 'Neuen Entwurf erstellen', hint: '' })

      const selectedDraft = await p.select({ message: 'Welchen Entwurf fortsetzen?', options: draftOptions })

      if (p.isCancel(selectedDraft)) return
      if (selectedDraft !== '__new__') {
        const draft = drafts.find(d => d.id === selectedDraft)
        if (draft) {
          const state = resumeDraft(draft)
          return runStateMachine(state, berufeLoader, einstellungen)
        }
      }
    }
  }

  const draftId = `einzelfall-${Date.now()}`
  const state: SessionState = {
    draftId,
    currentStep: 'name',
    schueler: {
      nachname: '',
      vorname: '',
      klasse: '',
      beruf: '',
      stufeSemester: '',
      noten: { lernfelder: new Map(), allgemeineFaecher: new Map() }
    },
    berufName: null,
    halbjahre: [],
    lastNote: null,
    undoStack: new UndoStack(),
    isDirty: false,
    lfStundenOverrides: new Map(),
    halbjahrStundenOverrides: {},
  }

  return runStateMachine(state, berufeLoader, einstellungen)
}
