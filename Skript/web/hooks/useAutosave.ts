import { useEffect, useRef, useState } from 'react'

type RequestBody = Record<string, unknown>

type DraftData = {
  body: RequestBody
  timestamp: number
  exported: boolean
}

interface SchuelerLike {
  loadFromVorlage: (data: {
    nachname?: string
    vorname?: string
    klasse?: string
    berufName?: string
    austritt?: string
    halbjahre?: string[]
    lernfelderNoten?: Record<string, number | null>
    allgFaecherNoten?: Record<string, (number | null)[]>
    lfStundenOverrides?: Record<string, number>
  }) => void
}

export function useAutosave(schueler: SchuelerLike | null, getRequestBody: () => RequestBody) {
  const [modalVisible, setModalVisible] = useState(false)
  const [draft, setDraft] = useState<DraftData | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  const initialBodyRef = useRef<RequestBody | null>(null)
  const getRequestBodyRef = useRef(getRequestBody)
  getRequestBodyRef.current = getRequestBody

  // On mount: read existing draft and prepare initial snapshot
  useEffect(() => {
    initialBodyRef.current = structuredClone(getRequestBodyRef.current()) as RequestBody
    try {
      const raw = localStorage.getItem('lusd-draft')
      if (raw) {
        const parsed = JSON.parse(raw) as DraftData | null
        if (parsed && parsed.body !== undefined) {
          setDraft({ body: parsed.body, timestamp: parsed.timestamp ?? Date.now(), exported: !!parsed.exported })
          setModalVisible(true)
        }
      }
    } catch {
      // ignore parsing errors
    }
  }, [])

  // Autosave on a ~500ms interval, only writing when body changed
  const lastBodyRef = useRef('')
  useEffect(() => {
    const interval = setInterval(() => {
      const body = structuredClone(getRequestBodyRef.current()) as RequestBody
      const current = JSON.stringify(body)
      if (lastBodyRef.current !== current) {
        const updated: DraftData = { body, timestamp: Date.now(), exported: draft?.exported ?? false }
        localStorage.setItem('lusd-draft', JSON.stringify(updated))
        setDraft(updated)
        setIsDirty(true)
        lastBodyRef.current = current
      }
    }, 500)
    return () => clearInterval(interval)
  }, [draft?.exported])

  // beforeunload warning when there are unsaved changes
  useEffect(() => {
    if (!isDirty || draft?.exported) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty, draft?.exported])

  const ladenDraft = () => {
    if (!draft) return
    if (schueler && typeof schueler.loadFromVorlage === 'function') {
      schueler.loadFromVorlage(draft.body)
    }
    setModalVisible(false)
    setIsDirty(false)
    initialBodyRef.current = structuredClone(getRequestBodyRef.current()) as RequestBody
  }

  const verwerfenDraft = () => {
    localStorage.removeItem('lusd-draft')
    setDraft(null)
    setModalVisible(false)
    setIsDirty(false)
  }

  const clearDraft = () => {
    localStorage.removeItem('lusd-draft')
    setDraft(null)
    setIsDirty(false)
  }

  // Mark current draft as exported after PDF download
  const pdfExported = () => {
    const body = getRequestBodyRef.current()
    const updated: DraftData = { body, timestamp: Date.now(), exported: true }
    localStorage.setItem('lusd-draft', JSON.stringify(updated))
    setDraft(updated)
    setIsDirty(false)
  }

  return {
    draft,
    modalVisible,
    ladenDraft,
    verwerfenDraft,
    clearDraft,
    onPdfGenerated: pdfExported,
  }
}
