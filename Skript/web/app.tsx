import { useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { DEFAULT_FACH_STUNDEN } from '../shared/constants'
import { AllgFaecher } from './components/AllgFaecher'
import { Einstellungen } from './components/Einstellungen'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Header } from './components/Header'
import { LernfelderGrid } from './components/LernfelderGrid'
import { useAutosave } from './hooks/useAutosave'
import { useSchueler } from './hooks/useSchueler'
import { useTheme } from './hooks/useTheme'
import { useUndo } from './hooks/useUndo'
import { generatePdf, getEinstellungen } from './lib/api'

const DEFAULT_STUNDEN: Record<string, Record<string, number>> = structuredClone(DEFAULT_FACH_STUNDEN)

function App() {
  const { theme, setTheme } = useTheme()
  const [halbjahrStunden, setHalbjahrStunden] = useState(DEFAULT_STUNDEN)

  useEffect(() => {
    getEinstellungen()
      .then(e => {
        if (e.halbjahrStunden) setHalbjahrStunden(e.halbjahrStunden)
      })
      .catch(() => {})
  }, [])

  const schueler = useSchueler(halbjahrStunden)
  const autosave = useAutosave(schueler, schueler.getRequestBody)
  // Undo integration for undo/redo of notes
  const undo = useUndo(schueler)
  const relevanteLernfelder = schueler.getRelevanteLernfelder()

  const handleLoadVorlage = useCallback(
    (data: unknown) => {
      const d = data as Record<string, unknown>
      if (d.halbjahrStunden && typeof d.halbjahrStunden === 'object') {
        setHalbjahrStunden(d.halbjahrStunden as Record<string, Record<string, number>>)
      }
      schueler.loadFromVorlage(d as Parameters<typeof schueler.loadFromVorlage>[0])
      undo.clearStack()
    },
    [schueler.loadFromVorlage, undo.clearStack],
  )

  // Keyboard shortcuts handled below after handlePdf definition

  const handlePdf = useCallback(async () => {
    try {
      const body = schueler.getRequestBody() as Record<string, unknown>
      const blob = await generatePdf(body)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const nn = (body.nachname as string) || 'Unbekannt'
      const vn = (body.vorname as string) || ''
      const kl = (body.klasse as string) || ''
      const aus = (body.austritt as string) || new Date().toISOString().slice(0, 10)
      const parts = [nn, vn, kl, aus].filter(Boolean).join('_')
      a.download = `${parts}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      if (typeof autosave.onPdfGenerated === 'function') autosave.onPdfGenerated()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      alert(`PDF-Fehler: ${msg}`)
    }
  }, [schueler, autosave])

  // Keyboard shortcuts and toast handling
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      const k = e.key.toLowerCase()
      if (mod && k === 'z') {
        e.preventDefault()
        undo.undo()
      }
      if (mod && k === 'p') {
        e.preventDefault()
        handlePdf()
      }
      if (mod && k === 's') {
        e.preventDefault()
        undo.showToast('Gespeichert')
      }
      if (e.key === 'Escape') {
        if (autosave?.verwerfenDraft) {
          autosave.verwerfenDraft()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handlePdf, autosave, undo])

  return (
    <div className="app">
      <Header
        nachname={schueler.nachname}
        vorname={schueler.vorname}
        klasse={schueler.klasse}
        austritt={schueler.austritt}
        anzahlHalbjahre={schueler.anzahlHalbjahre}
        berufName={schueler.berufName}
        berufLoading={schueler.berufLoading}
        onNachnameChange={schueler.setNachname}
        onVornameChange={schueler.setVorname}
        onKlasseChange={schueler.setKlasse}
        onAustrittChange={schueler.setAustritt}
        onHalbjahreChange={schueler.setAnzahlHalbjahre}
        onBerufSelect={schueler.loadBeruf}
        zeugnisTyp={schueler.zeugnisTyp}
        onZeugnisTypChange={schueler.setZeugnisTyp}
        theme={theme}
        onThemeSelect={setTheme}
      />

      {
        // Restore draft modal
        autosave.modalVisible && (
          <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Wiederherstellen eines Entwurfs">
            <div className="modal">
              <p>
                Nicht gespeicherte Eingaben vom{' '}
                {new Date(autosave.draft?.timestamp ?? Date.now()).toLocaleString('de-DE')} wiederherstellen?
              </p>
              <div className="modal-actions">
                <button className="btn-primary" onClick={autosave.ladenDraft}>
                  Laden
                </button>
                <button onClick={autosave.verwerfenDraft}>Verwerfen</button>
              </div>
            </div>
          </div>
        )
      }

      <div className="main-content">
        <LernfelderGrid
          berufData={schueler.berufData}
          relevanteLernfelder={relevanteLernfelder}
          lernfelderNoten={schueler.lernfelderNoten}
          halbjahre={schueler.halbjahre}
          onNoteChange={undo.wrapLfNote}
          ergebnis={schueler.ergebnis}
        />

        <AllgFaecher
          halbjahre={schueler.halbjahre}
          alleHalbjahre={schueler.ALLE_HALBJAHRE}
          allgemeineFaecher={schueler.ALLGEMEINE_FAECHER}
          allgFaecherNoten={schueler.allgFaecherNoten}
          halbjahrStunden={halbjahrStunden}
          onNoteChange={undo.wrapAllgNote}
          ergebnis={schueler.ergebnis}
        />
      </div>

      <Einstellungen
        halbjahrStunden={halbjahrStunden}
        lfStundenOverrides={schueler.lfStundenOverrides}
        berufData={schueler.berufData}
        onHalbjahrStundenChange={setHalbjahrStunden}
        onLfStundenChange={schueler.setLfStunden}
        getRequestBody={schueler.getRequestBody}
        onPdfGenerated={autosave.onPdfGenerated}
        clearDraft={autosave.clearDraft}
        onLoadVorlage={handleLoadVorlage}
        onReset={() => {
          schueler.reset()
          undo.clearStack()
        }}
      />
      {undo.toastVisible && undo.lastAction && <div className="toast">{undo.lastAction}</div>}
    </div>
  )
}

const container = document.getElementById('root')!
const root = createRoot(container)
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
)
