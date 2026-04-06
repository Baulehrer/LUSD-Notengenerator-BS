import React, { useCallback, useState } from 'react'
import type { BerufData } from '../hooks/useSchueler'
import { useTemplates } from '../hooks/useTemplates'
import { generatePdf, saveEinstellungen } from '../lib/api'
import { ALLE_HALBJAHRE, FACH_LABELS, FAECHER } from '../lib/constants'

interface Props {
  halbjahrStunden: Record<string, Record<string, number>>
  lfStundenOverrides: Record<string, number>
  berufData: BerufData | null
  onHalbjahrStundenChange: (stunden: Record<string, Record<string, number>>) => void
  onLfStundenChange: (lf: string, stunden: number) => void
  getRequestBody: () => unknown
  onLoadVorlage: (data: unknown) => void
  onReset: () => void
}

const LF_IDS = [
  'LF01',
  'LF02',
  'LF03',
  'LF04',
  'LF05',
  'LF06',
  'LF07',
  'LF08',
  'LF09',
  'LF10',
  'LF11',
  'LF12',
  'LF13',
  'LF14',
  'LF15',
  'LF16',
  'LF17',
  'LF18',
]

export function Einstellungen({
  halbjahrStunden,
  lfStundenOverrides,
  berufData,
  onHalbjahrStundenChange,
  onLfStundenChange,
  getRequestBody,
  onLoadVorlage,
  onReset,
}: Props) {
  const { store, save, remove } = useTemplates()
  const [modal, setModal] = useState<'stunden' | 'save-stunden' | 'save-schueler' | 'load' | null>(null)
  const [saveName, setSaveName] = useState('')
  const [editHjStunden, setEditHjStunden] = useState<Record<string, Record<string, number>>>({})
  const [editLfStunden, setEditLfStunden] = useState<Record<string, number>>({})
  const [pdfLoading, setPdfLoading] = useState(false)

  const openStundenEdit = useCallback(() => {
    // Deep clone halbjahrStunden
    const clone: Record<string, Record<string, number>> = {}
    for (const [hj, faecher] of Object.entries(halbjahrStunden)) {
      clone[hj] = { ...faecher }
    }
    setEditHjStunden(clone)
    // Merge beruf data with overrides
    const lfStd: Record<string, number> = {}
    for (const lf of LF_IDS) {
      lfStd[lf] = lfStundenOverrides[lf] ?? berufData?.lernfelder[lf] ?? 0
    }
    setEditLfStunden(lfStd)
    setModal('stunden')
  }, [halbjahrStunden, lfStundenOverrides, berufData])

  const saveStunden = useCallback(() => {
    onHalbjahrStundenChange(editHjStunden)
    saveEinstellungen({ halbjahrStunden: editHjStunden })
    // Apply LF overrides
    for (const [lf, std] of Object.entries(editLfStunden)) {
      const original = berufData?.lernfelder[lf] ?? 0
      if (std !== original) {
        onLfStundenChange(lf, std)
      }
    }
    setModal(null)
  }, [editHjStunden, editLfStunden, onHalbjahrStundenChange, onLfStundenChange, berufData])

  const handleSaveTemplate = useCallback(
    async (type: 'stunden' | 'komplett') => {
      if (!saveName.trim()) return
      const data = type === 'stunden' ? { halbjahrStunden, lfStundenOverrides } : getRequestBody()
      await save(type, saveName.trim(), data)
      setSaveName('')
      setModal(null)
    },
    [saveName, halbjahrStunden, lfStundenOverrides, getRequestBody, save],
  )

  const handleLoadTemplate = useCallback(
    (data: unknown) => {
      onLoadVorlage(data)
      setModal(null)
    },
    [onLoadVorlage],
  )

  const handlePdf = useCallback(async () => {
    setPdfLoading(true)
    try {
      const body = getRequestBody() as Record<string, unknown>
      const blob = await generatePdf(body)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      // Filename: Name_Vorname_Klasse_Austrittsdatum.pdf
      const nn = (body.nachname as string) || 'Unbekannt'
      const vn = (body.vorname as string) || ''
      const kl = (body.klasse as string) || ''
      const aus = (body.austritt as string) || new Date().toISOString().slice(0, 10)
      const parts = [nn, vn, kl, aus].filter(Boolean).join('_')
      a.download = `${parts}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      alert(`PDF-Fehler: ${msg}`)
    }
    setPdfLoading(false)
  }, [getRequestBody])

  const allTemplates = [
    ...store.stundenTemplates.map(t => ({ ...t, type: 'stunden' as const })),
    ...store.komplettVorlagen.map(t => ({ ...t, type: 'komplett' as const })),
  ]

  // Filter LFs that have stunden > 0
  const activeLfIds = LF_IDS.filter(lf => (editLfStunden[lf] ?? 0) > 0 || (berufData?.lernfelder[lf] ?? 0) > 0)

  const updateFachStunden = (hj: string, fach: string, value: number) => {
    setEditHjStunden(prev => ({
      ...prev,
      [hj]: { ...prev[hj], [fach]: value },
    }))
  }

  return (
    <>
      <div className="settings-bar">
        <span className="settings-bar-label">Einstellungen:</span>

        <button onClick={() => setModal('load')} disabled={allTemplates.length === 0}>
          Vorlage laden
        </button>

        <button onClick={() => setModal('save-schueler')}>Schüler speichern</button>

        <button onClick={() => setModal('save-stunden')}>Stundenwerte speichern</button>

        <button onClick={openStundenEdit}>Stunden ändern</button>

        <button onClick={onReset} className="btn-danger">
          Zurücksetzen
        </button>

        <div style={{ flex: 1 }} />

        <button onClick={handlePdf} className="btn-primary" disabled={pdfLoading}>
          {pdfLoading ? 'Generiere...' : 'PDF erstellen'}
        </button>
      </div>

      {/* Stunden Edit Modal (Fächer + Lernfelder) */}
      {modal === 'stunden' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <h3>Stundenwerte ändern</h3>

            <div className="stunden-edit-section">
              <h4>Allgemeine Fächer (Stunden pro Halbjahr)</h4>
              <table className="stunden-fach-table">
                <thead>
                  <tr>
                    <th>Fach</th>
                    {ALLE_HALBJAHRE.map(hj => (
                      <th key={hj}>{hj}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FAECHER.map(fach => (
                    <tr key={fach}>
                      <td className="fach-label">{FACH_LABELS[fach]}</td>
                      {ALLE_HALBJAHRE.map(hj => (
                        <td key={hj}>
                          <input
                            type="number"
                            min={0}
                            value={editHjStunden[hj]?.[fach] ?? 0}
                            onChange={e => updateFachStunden(hj, fach, parseInt(e.target.value, 10) || 0)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {berufData && (
              <div className="stunden-edit-section">
                <h4>Lernfeld-Stunden ({berufData.name})</h4>
                <div className="stunden-lf-grid">
                  {activeLfIds.map(lf => {
                    const num = parseInt(lf.replace('LF', ''), 10)
                    return (
                      <React.Fragment key={lf}>
                        <label>LF {num}:</label>
                        <input
                          type="number"
                          min={0}
                          value={editLfStunden[lf] ?? 0}
                          onChange={e =>
                            setEditLfStunden(prev => ({ ...prev, [lf]: parseInt(e.target.value, 10) || 0 }))
                          }
                        />
                      </React.Fragment>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button onClick={() => setModal(null)}>Abbrechen</button>
              <button onClick={saveStunden} className="btn-primary">
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Stunden Template */}
      {modal === 'save-stunden' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Stundenwerte als Vorlage speichern</h3>
            <input
              type="text"
              placeholder="Name der Vorlage"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveTemplate('stunden')
              }}
            />
            <div className="modal-actions">
              <button
                onClick={() => {
                  setModal(null)
                  setSaveName('')
                }}
              >
                Abbrechen
              </button>
              <button onClick={() => handleSaveTemplate('stunden')} className="btn-primary" disabled={!saveName.trim()}>
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Schüler Template */}
      {modal === 'save-schueler' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Schüler als Vorlage speichern</h3>
            <input
              type="text"
              placeholder="Name der Vorlage (z.B. Mustermann, Max)"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveTemplate('komplett')
              }}
            />
            <div className="modal-actions">
              <button
                onClick={() => {
                  setModal(null)
                  setSaveName('')
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleSaveTemplate('komplett')}
                className="btn-primary"
                disabled={!saveName.trim()}
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Template */}
      {modal === 'load' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Vorlage laden</h3>
            {allTemplates.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>Keine Vorlagen gespeichert.</p>
            ) : (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {allTemplates.map(t => (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 0',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <div>
                      <strong>{t.name}</strong>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: 8 }}>
                        [{t.type === 'stunden' ? 'Stundenwerte' : 'Schüler'}]
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => handleLoadTemplate(t.data)}
                        style={{ fontSize: '0.8rem', padding: '5px 10px' }}
                      >
                        Laden
                      </button>
                      <button
                        onClick={() => remove(t.id)}
                        className="btn-danger"
                        style={{ fontSize: '0.8rem', padding: '5px 10px' }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button onClick={() => setModal(null)}>Schließen</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
