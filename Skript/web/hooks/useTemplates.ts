import { useCallback, useEffect, useState } from 'react'
import { deleteTemplate, getTemplates, saveTemplate, type TemplateStore } from '../lib/api'

export function useTemplates() {
  const [store, setStore] = useState<TemplateStore>({ stundenTemplates: [], komplettVorlagen: [] })
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await getTemplates()
      setStore(data)
    } catch {
      // ignore
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const save = useCallback(
    async (type: 'stunden' | 'komplett', name: string, data: unknown) => {
      await saveTemplate(type, name, data)
      await refresh()
    },
    [refresh],
  )

  const remove = useCallback(
    async (id: string) => {
      await deleteTemplate(id)
      await refresh()
    },
    [refresh],
  )

  return { store, loading, save, remove, refresh }
}
