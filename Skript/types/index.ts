export interface Lernfeld {
  id: string
  name: string
  stunden: number
}

export interface Beruf {
  name: string
  lernfelder: Map<string, number>
}

export interface NoteEintrag {
  note: number | null
  lehrer: string
}

export interface Halbjahr {
  jahr: number
  halbjahr: 1 | 2
  label: string
}

export interface SchuelerNoten {
  lernfelder: Map<string, NoteEintrag[]>
  allgemeineFaecher: Map<string, NoteEintrag[]>
}

export interface Schueler {
  nachname: string
  vorname: string
  klasse: string
  beruf: string
  stufeSemester: string
  halbjahre?: string[]   // NEU
  noten: SchuelerNoten
}

export interface Berechnungsergebnis {
  schueler: Schueler
  bbuNote: number
  bbuNoteGerundet: number
  allgemeineFaecherNoten: Map<string, { note: number; noteGerundet: number }>
  gesamtnote: number
  gesamtnoteGerundet: number
  stundenBBU: number
  stundenAllg: number
  gewichtungBBU: number
  gewichtungAllg: number
}

export interface KlassenErgebnis {
  klasse: string
  schuljahr: string
  halbjahr: string
  schueler: Berechnungsergebnis[]
}

export const LERNFELDER = ['LF01', 'LF02', 'LF03', 'LF04', 'LF05', 'LF06', 'LF07', 'LF08', 'LF09', 'LF10', 'LF11', 'LF12', 'LF13', 'LF14', 'LF15', 'LF16', 'LF17', 'LF18'] as const
export type LernfeldId = typeof LERNFELDER[number]

export const ALLGEMEINE_FAECHER = ['D', 'POWI', 'RKA', 'SPO', 'ENG'] as const
export type AllgemeinesFach = typeof ALLGEMEINE_FAECHER[number]

export const HALBJAHRE_STUNDEN: Map<string, number> = new Map([
  ['10/1', 0],
  ['10/2', 40],
  ['11/1', 20],
  ['11/2', 20],
  ['12/1', 20],
  ['12/2', 20],
  ['13/1', 20],
])

// ── Einzelfall-Specific Types ─────────────────────────────────────

export type EinzelfallStep = 'name' | 'klasse' | 'semester' | 'beruf' | 'lernfelder' | 'allgFaecher' | 'preview' | 'ergebnis'

export interface EinzelfallDraft {
  id: string
  createdAt: string
  updatedAt: string
  schueler: Partial<Schueler>
  lastNote: number | null
  currentStep: EinzelfallStep
  berufName: string | null
  halbjahre: string[]
  lfStundenOverrides?: Record<string, number>
  halbjahrStundenOverrides?: Record<string, number>
}