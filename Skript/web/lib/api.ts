const BASE = ''

export async function searchBerufe(query: string): Promise<string[]> {
  const res = await fetch(`${BASE}/api/berufe?q=${encodeURIComponent(query)}`)
  return res.json()
}

export async function getBeruf(name: string): Promise<{ name: string; lernfelder: Record<string, number> }> {
  const res = await fetch(`${BASE}/api/beruf/${encodeURIComponent(name)}`)
  if (!res.ok) throw new Error('Beruf nicht gefunden')
  return res.json()
}

export async function generatePdf(data: unknown): Promise<Blob> {
  const res = await fetch(`${BASE}/api/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = (await res.json()) as { error: string }
    throw new Error(err.error)
  }
  return res.blob()
}

export async function getEinstellungen(): Promise<{
  halbjahrStunden: Record<string, Record<string, number>>
  tutorialTipps: boolean
}> {
  const res = await fetch(`${BASE}/api/einstellungen`)
  return res.json()
}

export async function saveEinstellungen(data: unknown): Promise<void> {
  await fetch(`${BASE}/api/einstellungen`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export interface TemplateStore {
  stundenTemplates: { id: string; name: string; data: unknown }[]
  komplettVorlagen: { id: string; name: string; data: unknown }[]
}

export async function getTemplates(): Promise<TemplateStore> {
  const res = await fetch(`${BASE}/api/templates`)
  return res.json()
}

export async function saveTemplate(type: 'stunden' | 'komplett', name: string, data: unknown): Promise<void> {
  await fetch(`${BASE}/api/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, name, data }),
  })
}

export async function deleteTemplate(id: string): Promise<void> {
  await fetch(`${BASE}/api/templates/${id}`, { method: 'DELETE' })
}
