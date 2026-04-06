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
  halbjahre?: string[] // NEU
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

export type { AllgemeinesFach, LernfeldId } from '../shared/constants'
// Konstanten liegen in shared/constants.ts. Typen werden hier re-exportiert,
// damit bestehende Imports aus '../types' weiter funktionieren.
export { ALLGEMEINE_FAECHER, LERNFELDER } from '../shared/constants'

// ── Einzelfall-Specific Types ─────────────────────────────────────

export type EinzelfallStep =
  | 'name'
  | 'klasse'
  | 'semester'
  | 'beruf'
  | 'lernfelder'
  | 'allgFaecher'
  | 'preview'
  | 'ergebnis'

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
