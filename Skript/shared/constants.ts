// ── Lernfelder / Fächer ──────────────────────────────────────────────────
export const LERNFELDER = [
  'LF01', 'LF02', 'LF03', 'LF04', 'LF05', 'LF06',
  'LF07', 'LF08', 'LF09', 'LF10', 'LF11', 'LF12',
  'LF13', 'LF14', 'LF15', 'LF16', 'LF17', 'LF18',
] as const
export type LernfeldId = typeof LERNFELDER[number]

export const ALLGEMEINE_FAECHER = ['D', 'POWI', 'RKA', 'SPO', 'ENG'] as const
export type AllgemeinesFach = typeof ALLGEMEINE_FAECHER[number]

// Bewusst als Record<string, string> deklariert, damit dynamische Lookups
// mit einem allgemeinen string-Key weiter möglich sind (Komponenten mappen
// über string-Listen).
export const FACH_LABELS: Record<string, string> = {
  D: 'Deutsch',
  POWI: 'Politik & Wirtschaft',
  RKA: 'Religion',
  SPO: 'Sport',
  ENG: 'Englisch',
}

// ── Halbjahre & Ausbildungsjahre ────────────────────────────────────────
// 10/1 hat keine Noten. 10/2 zählt als komplettes 1. AJ (deshalb doppelte Gewichtung
// gegenüber den anderen HJ). 2. AJ = 11/1+11/2, 3. AJ = 12/1+12/2. 13/1 ist optional.
export const ALLE_HALBJAHRE = ['10/2', '11/1', '11/2', '12/1', '12/2', '13/1'] as const
export type Halbjahr = typeof ALLE_HALBJAHRE[number]

export const AUSBILDUNGSJAHRE = [
  { label: '1. AJ', halbjahre: ['10/2'] },
  { label: '2. AJ', halbjahre: ['11/1', '11/2'] },
  { label: '3. AJ', halbjahre: ['12/1', '12/2'] },
] as const

/**
 * Mapping vom Dropdown-Wert „Anzahl Halbjahre" (1–7) auf die tatsächlich
 * aktiven Halbjahr-Slots. Index 0 und 1 liefern beide `['10/2']`, weil
 * 10/2 das komplette 1. Ausbildungsjahr abdeckt und in der UI für zwei
 * Halbjahr-Slots zählt.
 */
export const HALBJAHR_MAP: readonly (readonly string[])[] = [
  ['10/2'],
  ['10/2'],
  ['10/2', '11/1'],
  ['10/2', '11/1', '11/2'],
  ['10/2', '11/1', '11/2', '12/1'],
  ['10/2', '11/1', '11/2', '12/1', '12/2'],
  ['10/2', '11/1', '11/2', '12/1', '12/2', '13/1'],
] as const

/**
 * Kumulative Stundengrenze, bis zu der Lernfelder im jeweiligen Semester
 * relevant sind. Schneidet die LF-Liste pro Beruf an der richtigen Stelle ab.
 * 1. AJ (10/2 + 11/1-Slot): 320h
 * 2. AJ (11/2 + 12/1): 600h
 * 3. AJ (12/2 + 13/1): 880h
 */
export const STUNDEN_GRENZEN: Record<string, number> = {
  '10/2': 320,
  '11/1': 320,
  '11/2': 600,
  '12/1': 600,
  '12/2': 880,
  '13/1': 880,
}

// ── Helper ───────────────────────────────────────────────────────────────
/** Baut ein Per-Fach-Stunden-Record, in dem jedes allgemeinbildende Fach denselben Wert bekommt. */
export function fachStunden(std: number): Record<AllgemeinesFach, number> {
  const r = {} as Record<AllgemeinesFach, number>
  for (const f of ALLGEMEINE_FAECHER) r[f] = std
  return r
}

/** Default-Stunden pro Halbjahr und Fach (40h in 10/2, sonst 20h). */
export const DEFAULT_FACH_STUNDEN: Record<string, Record<AllgemeinesFach, number>> = {
  '10/2': fachStunden(40),
  '11/1': fachStunden(20),
  '11/2': fachStunden(20),
  '12/1': fachStunden(20),
  '12/2': fachStunden(20),
  '13/1': fachStunden(20),
}
