import { useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { DEFAULT_FACH_STUNDEN } from '../shared/constants'
import { AllgFaecher } from './components/AllgFaecher'
import { Einstellungen } from './components/Einstellungen'
import { Header } from './components/Header'
import { LernfelderGrid } from './components/LernfelderGrid'
import { useSchueler } from './hooks/useSchueler'
import { useTheme } from './hooks/useTheme'
import { getEinstellungen } from './lib/api'

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
  const relevanteLernfelder = schueler.getRelevanteLernfelder()

  const handleLoadVorlage = useCallback(
    (data: unknown) => {
      const d = data as Record<string, unknown>
      if (d.halbjahrStunden && typeof d.halbjahrStunden === 'object') {
        setHalbjahrStunden(d.halbjahrStunden as Record<string, Record<string, number>>)
      }
      schueler.loadFromVorlage(d as Parameters<typeof schueler.loadFromVorlage>[0])
    },
    [schueler.loadFromVorlage],
  )

  return (
    <div className="app">
      <Header
        nachname={schueler.nachname}
        vorname={schueler.vorname}
        klasse={schueler.klasse}
        austritt={schueler.austritt}
        anzahlHalbjahre={schueler.anzahlHalbjahre}
        berufName={schueler.berufName}
        onNachnameChange={schueler.setNachname}
        onVornameChange={schueler.setVorname}
        onKlasseChange={schueler.setKlasse}
        onAustrittChange={schueler.setAustritt}
        onHalbjahreChange={schueler.setAnzahlHalbjahre}
        onBerufSelect={schueler.loadBeruf}
        theme={theme}
        onThemeSelect={setTheme}
      />

      <div className="main-content">
        <LernfelderGrid
          berufData={schueler.berufData}
          relevanteLernfelder={relevanteLernfelder}
          lernfelderNoten={schueler.lernfelderNoten}
          halbjahre={schueler.halbjahre}
          onNoteChange={schueler.setLfNote}
          ergebnis={schueler.ergebnis}
        />

        <AllgFaecher
          halbjahre={schueler.halbjahre}
          alleHalbjahre={schueler.ALLE_HALBJAHRE}
          allgemeineFaecher={schueler.ALLGEMEINE_FAECHER}
          allgFaecherNoten={schueler.allgFaecherNoten}
          halbjahrStunden={halbjahrStunden}
          onNoteChange={schueler.setAllgNote}
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
        onLoadVorlage={handleLoadVorlage}
        onReset={schueler.reset}
      />
    </div>
  )
}

const container = document.getElementById('root')!
const root = createRoot(container)
root.render(<App />)
