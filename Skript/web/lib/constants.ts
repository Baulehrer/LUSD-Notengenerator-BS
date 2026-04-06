// 1. AJ = 10/2 (zählt doppelt, da 10/1 keine Noten), 2. AJ = 11/1+11/2, 3. AJ = 12/1+12/2
export const AUSBILDUNGSJAHRE = [
  { label: '1. AJ', halbjahre: ['10/2'] },
  { label: '2. AJ', halbjahre: ['11/1', '11/2'] },
  { label: '3. AJ', halbjahre: ['12/1', '12/2'] },
] as const

export const ALLE_HALBJAHRE = ['10/2', '11/1', '11/2', '12/1', '12/2', '13/1'] as const

export const FAECHER = ['D', 'POWI', 'RKA', 'SPO', 'ENG'] as const

export const FACH_LABELS: Record<string, string> = {
  D: 'Deutsch',
  POWI: 'Politik & Wirtschaft',
  RKA: 'Religion',
  SPO: 'Sport',
  ENG: 'Englisch',
}
