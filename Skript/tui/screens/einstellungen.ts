import * as p from '@clack/prompts'
import type { Einstellungen } from '../../config/einstellungen'
import { DEFAULT_HALBJAHR_STUNDEN, defaultEinstellungen, speichereEinstellungen } from '../../config/einstellungen'
import { ALLE_HALBJAHRE as ALL_HJ } from '../../shared/constants'

export async function einstellungenScreen(einstellungen: Einstellungen): Promise<void> {
  while (true) {
    console.clear()
    p.intro('⚙️  Einstellungen')

    const hjOptions = ALL_HJ.map(hj => ({
      value: hj,
      label: `${hj}  →  ${einstellungen.halbjahrStunden[hj] ?? DEFAULT_HALBJAHR_STUNDEN[hj]}h`,
      hint: 'Gewichtung — bestimmt Einfluss auf Endnote'
    }))

    const tippsLabel = einstellungen.tutorialTipps ? 'AN' : 'AUS'

    const action = await p.select({
      message: 'Einstellung auswählen zum Bearbeiten',
      options: [
        ...hjOptions,
        { value: '__tipps__', label: `💡 Kontextuelle Tipps: ${tippsLabel}`, hint: 'Erklärungen bei jedem Schritt anzeigen' },
        { value: '__reset__', label: '↺ Auf Standardwerte zurücksetzen', hint: '' },
        { value: '__back__', label: '← Zurück', hint: '' }
      ]
    })

    if (p.isCancel(action) || action === '__back__') return

    if (action === '__tipps__') {
      einstellungen.tutorialTipps = !einstellungen.tutorialTipps
      await speichereEinstellungen(einstellungen)
      p.log.success(`Kontextuelle Tipps: ${einstellungen.tutorialTipps ? 'AN' : 'AUS'}`)
      continue
    }

    if (action === '__reset__') {
      const defaults = defaultEinstellungen()
      einstellungen.halbjahrStunden = defaults.halbjahrStunden
      einstellungen.tutorialTipps = defaults.tutorialTipps
      await speichereEinstellungen(einstellungen)
      p.log.success('Standardwerte wiederhergestellt')
      continue
    }

    const hj = action as string
    const current = einstellungen.halbjahrStunden[hj] ?? DEFAULT_HALBJAHR_STUNDEN[hj]

    const input = await p.text({
      message: `Stunden für ${hj}`,
      initialValue: String(current ?? 0),
      validate: (v) => {
        const n = parseInt(v ?? '', 10)
        if (isNaN(n) || n < 0) return 'Bitte eine gültige positive Zahl eingeben'
      }
    })

    if (p.isCancel(input)) continue

    einstellungen.halbjahrStunden[hj] = parseInt(input as string, 10)
    await speichereEinstellungen(einstellungen)
    p.log.success(`${hj}: ${einstellungen.halbjahrStunden[hj]}h gespeichert`)
  }
}
