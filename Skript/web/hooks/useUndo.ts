import { useCallback, useRef, useState } from 'react'

type LfChange = {
  type: 'lf'
  key: string
  oldValue: number | null
  newValue: number | null
}

type AllgChange = {
  type: 'allg'
  key: string
  hjIndex: number
  oldValue: number | null
  newValue: number | null
}

type ChangeEntry = LfChange | AllgChange

interface SchuelerActions {
  lernfelderNoten: Record<string, number | null>
  allgFaecherNoten: Record<string, (number | null)[]>
  setLfNote: (lf: string, note: number | null) => void
  setAllgNote: (fach: string, hjIndex: number, note: number | null) => void
}

export function useUndo(schueler: SchuelerActions) {
  const stackRef = useRef<ChangeEntry[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [lastAction, setLastAction] = useState<string | null>(null)

  const push = useCallback((entry: ChangeEntry) => {
    stackRef.current = [...stackRef.current, entry].slice(-20)
    setCanUndo(true)
  }, [])

  const undo = useCallback(() => {
    const arr = stackRef.current
    const last = arr.pop()
    if (!last) return
    stackRef.current = [...arr]
    setCanUndo(arr.length > 0)

    if (last.type === 'lf') {
      schueler.setLfNote(last.key, last.oldValue)
      setLastAction(`Rückgängig: ${last.key} ${last.newValue ?? '–'} → ${last.oldValue ?? '–'}`)
    } else {
      schueler.setAllgNote(last.key, last.hjIndex, last.oldValue)
      setLastAction(`Rückgängig: ${last.key} ${last.newValue ?? '–'} → ${last.oldValue ?? '–'}`)
    }
  }, [schueler])

  const clearStack = useCallback(() => {
    stackRef.current = []
    setCanUndo(false)
  }, [])

  // Auto-hide toast after 2s
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    setLastAction(msg)
    setToastVisible(true)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => {
      setToastVisible(false)
      setLastAction(null)
    }, 2000)
  }, [])

  const wrapLfNote = useCallback(
    (lf: string, note: number | null) => {
      const oldValue = schueler.lernfelderNoten[lf] ?? null
      schueler.setLfNote(lf, note)
      if (note !== oldValue) {
        push({ type: 'lf', key: lf, oldValue, newValue: note })
      }
    },
    [schueler, push],
  )

  const wrapAllgNote = useCallback(
    (fach: string, hjIndex: number, note: number | null) => {
      const oldArr = schueler.allgFaecherNoten[fach]
      const oldValue = oldArr?.[hjIndex] ?? null
      schueler.setAllgNote(fach, hjIndex, note)
      if (note !== oldValue) {
        push({ type: 'allg', key: fach, hjIndex, oldValue, newValue: note })
      }
    },
    [schueler, push],
  )

  return { undo, canUndo, lastAction, toastVisible, wrapLfNote, wrapAllgNote, showToast, clearStack }
}
