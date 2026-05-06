import { useCallback, useEffect, useState } from 'react'
import { calculateSchuelerNoten } from '../../core/grades'
import { ALLE_HALBJAHRE, ALLGEMEINE_FAECHER, HALBJAHR_MAP, LERNFELDER, STUNDEN_GRENZEN } from '../../shared/constants'
import type { Beruf, NoteEintrag, Schueler } from '../../types'
import { getBeruf } from '../lib/api'

export interface BerufData {
  name: string
  lernfelder: Record<string, number>
}

export interface Ergebnis {
  bbuNote: number
  bbuNoteGerundet: number
  gesamtnote: number
  gesamtnoteGerundet: number
  stundenBBU: number
  stundenAllg: number
  gewichtungBBU: number
  gewichtungAllg: number
  allgemeineFaecherNoten: Record<string, { note: number; noteGerundet: number }>
}

export function useSchueler(halbjahrStunden: Record<string, Record<string, number>>) {
  const [nachname, setNachname] = useState('')
  const [vorname, setVorname] = useState('')
  const [klasse, setKlasse] = useState('')
  const [austritt, setAustritt] = useState('')
  const [anzahlHalbjahre, setAnzahlHalbjahre] = useState(6)
  const [berufName, setBerufName] = useState('')
  const [berufData, setBerufData] = useState<BerufData | null>(null)
  const [berufLoading, setBerufLoading] = useState(false)
  const [zeugnisTyp, setZeugnisTyp] = useState<'abschluss' | 'abgang'>('abschluss')
  const [lernfelderNoten, setLernfelderNoten] = useState<Record<string, number | null>>({})
  const [allgFaecherNoten, setAllgFaecherNoten] = useState<Record<string, (number | null)[]>>(() => {
    const init: Record<string, (number | null)[]> = {}
    for (const fach of ALLGEMEINE_FAECHER) {
      init[fach] = Array(6).fill(null)
    }
    return init
  })
  const [lfStundenOverrides, setLfStundenOverrides] = useState<Record<string, number>>({})
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null)

  const halbjahre: string[] = [...(HALBJAHR_MAP[anzahlHalbjahre - 1] ?? HALBJAHR_MAP[6]!)]
  const semester = halbjahre[halbjahre.length - 1] || '10/2'

  const getRelevanteLernfelder = useCallback(() => {
    if (!berufData) return []
    const maxStunden = STUNDEN_GRENZEN[semester] ?? Infinity
    const result: { lf: string; stunden: number }[] = []
    let cumulative = 0
    for (const lf of LERNFELDER) {
      const stunden = lfStundenOverrides[lf] ?? berufData.lernfelder[lf] ?? 0
      if (stunden === 0) continue
      cumulative += stunden
      if (cumulative > maxStunden) break
      result.push({ lf, stunden })
    }
    return result
  }, [berufData, semester, lfStundenOverrides])

  const loadBeruf = useCallback(async (name: string) => {
    setBerufName(name)
    setBerufLoading(true)
    try {
      const data = await getBeruf(name)
      setBerufData(data)
      setLernfelderNoten({})
      setLfStundenOverrides({})
    } catch {
      setBerufData(null)
    } finally {
      setBerufLoading(false)
    }
  }, [])

  const setLfNote = useCallback((lf: string, note: number | null) => {
    setLernfelderNoten(prev => ({ ...prev, [lf]: note }))
  }, [])

  const setAllgNote = useCallback((fach: string, hjIndex: number, note: number | null) => {
    setAllgFaecherNoten(prev => {
      const copy = { ...prev }
      const arr = [...(copy[fach] || Array(6).fill(null))]
      arr[hjIndex] = note
      copy[fach] = arr
      return copy
    })
  }, [])

  const setLfStunden = useCallback((lf: string, stunden: number) => {
    setLfStundenOverrides(prev => ({ ...prev, [lf]: stunden }))
  }, [])

  // Live calculation (client-side, synchron)
  useEffect(() => {
    if (!berufData || !berufName) {
      setErgebnis(null)
      return
    }

    try {
      const lfNoten = new Map<string, NoteEintrag[]>()
      for (const [lf, note] of Object.entries(lernfelderNoten)) {
        lfNoten.set(lf, [{ note: note && note > 0 ? note : null, lehrer: '' }])
      }
      const allgNoten = new Map<string, NoteEintrag[]>()
      for (const [fach, noten] of Object.entries(allgFaecherNoten)) {
        allgNoten.set(
          fach,
          noten.map(n => ({ note: n && n > 0 ? n : null, lehrer: '' })),
        )
      }
      const schueler: Schueler = {
        nachname,
        vorname,
        klasse,
        beruf: berufName,
        stufeSemester: semester,
        halbjahre,
        noten: { lernfelder: lfNoten, allgemeineFaecher: allgNoten },
      }
      const beruf: Beruf = {
        name: berufData.name,
        lernfelder: new Map(Object.entries(berufData.lernfelder)),
      }
      const lfOverrides =
        Object.keys(lfStundenOverrides).length > 0
          ? new Map(Object.entries(lfStundenOverrides).map(([k, v]) => [k, Number(v)]))
          : undefined

      const result = calculateSchuelerNoten(schueler, beruf, halbjahre, halbjahrStunden, lfOverrides)
      const allgFaecherNotenObj: Record<string, { note: number; noteGerundet: number }> = {}
      for (const [fach, val] of result.allgemeineFaecherNoten) {
        allgFaecherNotenObj[fach] = val
      }
      setErgebnis({
        bbuNote: result.bbuNote,
        bbuNoteGerundet: result.bbuNoteGerundet,
        gesamtnote: result.gesamtnote,
        gesamtnoteGerundet: result.gesamtnoteGerundet,
        stundenBBU: result.stundenBBU,
        stundenAllg: result.stundenAllg,
        gewichtungBBU: result.gewichtungBBU,
        gewichtungAllg: result.gewichtungAllg,
        allgemeineFaecherNoten: allgFaecherNotenObj,
      })
    } catch {
      setErgebnis(null)
    }
  }, [
    nachname,
    vorname,
    klasse,
    berufName,
    berufData,
    halbjahre,
    semester,
    austritt,
    lernfelderNoten,
    allgFaecherNoten,
    halbjahrStunden,
    lfStundenOverrides,
  ])

  const getRequestBody = useCallback(
    () => ({
      nachname,
      vorname,
      klasse,
      berufName,
      halbjahre,
      semester,
      austritt,
      zeugnisTyp,
      lernfelderNoten,
      allgFaecherNoten,
      halbjahrStunden,
      lfStundenOverrides: Object.keys(lfStundenOverrides).length > 0 ? lfStundenOverrides : undefined,
    }),
    [
      nachname,
      vorname,
      klasse,
      berufName,
      halbjahre,
      semester,
      austritt,
      zeugnisTyp,
      lernfelderNoten,
      allgFaecherNoten,
      halbjahrStunden,
      lfStundenOverrides,
    ],
  )

  const loadFromVorlage = useCallback(
    (data: {
      nachname?: string
      vorname?: string
      klasse?: string
      berufName?: string
      austritt?: string
      zeugnisTyp?: 'abschluss' | 'abgang'
      halbjahre?: string[]
      lernfelderNoten?: Record<string, number | null>
      allgFaecherNoten?: Record<string, (number | null)[]>
      lfStundenOverrides?: Record<string, number>
    }) => {
      if (data.nachname !== undefined) setNachname(data.nachname)
      if (data.vorname !== undefined) setVorname(data.vorname)
      if (data.klasse !== undefined) setKlasse(data.klasse)
      if (data.austritt !== undefined) setAustritt(data.austritt)
      if (data.zeugnisTyp) setZeugnisTyp(data.zeugnisTyp)
      if (data.halbjahre) setAnzahlHalbjahre(data.halbjahre.length)
      if (data.lernfelderNoten) setLernfelderNoten(data.lernfelderNoten)
      if (data.allgFaecherNoten) setAllgFaecherNoten(data.allgFaecherNoten)
      if (data.lfStundenOverrides) setLfStundenOverrides(data.lfStundenOverrides)
      if (data.berufName) loadBeruf(data.berufName)
    },
    [loadBeruf],
  )

  const reset = useCallback(() => {
    setNachname('')
    setVorname('')
    setKlasse('')
    setAustritt('')
    setAnzahlHalbjahre(6)
    setBerufName('')
    setBerufData(null)
    setZeugnisTyp('abschluss')
    setLernfelderNoten({})
    setLfStundenOverrides({})
    setErgebnis(null)
    const init: Record<string, (number | null)[]> = {}
    for (const fach of ALLGEMEINE_FAECHER) {
      init[fach] = Array(6).fill(null)
    }
    setAllgFaecherNoten(init)
  }, [])

  return {
    nachname,
    vorname,
    klasse,
    austritt,
    anzahlHalbjahre,
    berufName,
    berufData,
    berufLoading,
    zeugnisTyp,
    setZeugnisTyp,
    lernfelderNoten,
    allgFaecherNoten,
    lfStundenOverrides,
    ergebnis,
    halbjahre,
    semester,
    setNachname,
    setVorname,
    setKlasse,
    setAustritt,
    setAnzahlHalbjahre,
    loadBeruf,
    setLfNote,
    setAllgNote,
    setLfStunden,
    getRelevanteLernfelder,
    getRequestBody,
    loadFromVorlage,
    reset,
    ALLE_HALBJAHRE: [...ALLE_HALBJAHRE] as string[],
    ALLGEMEINE_FAECHER: [...ALLGEMEINE_FAECHER] as string[],
    LERNFELDER: [...LERNFELDER] as string[],
  }
}
