import * as p from '@clack/prompts'
import { BerufeLoader } from '../import/berufe-loader'
import { einzelfallBerechnung } from './screens/einzelfall'
import { einstellungenScreen } from './screens/einstellungen'
import { showIntro } from './intro'
import { ladeEinstellungen } from '../config/einstellungen'

const DATA_FILE = 'data/BS_Schulformen_Berufe_Lernfelder.xlsx'

export async function main() {
  await showIntro()

  p.intro('🎓 LUSD Notengenerator')

  const einstellungen = await ladeEinstellungen()

  const berufeLoader = new BerufeLoader()

  const spinner = p.spinner()
  spinner.start('Berufe-Datei wird geladen…')

  try {
    await berufeLoader.load(DATA_FILE)
    spinner.stop(`Berufe geladen: ${berufeLoader.getAllBerufe().length}`)
  } catch (error) {
    spinner.stop('Fehler beim Laden der Berufe-Datei')
    p.log.error(`${error}`)
    p.log.info('Bitte stelle sicher, dass die Datei "data/BS_Schulformen_Berufe_Lernfelder.xlsx" existiert.')
    process.exit(1)
  }

  while (true) {
    const action = await p.select({
      message: 'Was möchtest du tun?',
      options: [
        { value: 'einzelfall', label: '📝 Einzelfallberechnung (Abgangszeugnis)', hint: 'Manuelle Eingabe für einen Schüler' },
        { value: 'klasse', label: '📊 Klassenberechnung (Abschlusszeugnis)', hint: 'bald verfügbar' },
        { value: 'einstellungen', label: '⚙️  Einstellungen', hint: 'Halbjahr-Stunden konfigurieren' },
        { value: 'exit', label: '❌ Beenden', hint: 'Programm schließen' }
      ]
    })

    if (p.isCancel(action)) {
      p.outro('Auf Wiedersehen!')
      process.exit(0)
    }

    switch (action) {
      case 'einzelfall':
        await einzelfallBerechnung(berufeLoader, einstellungen)
        break
      case 'klasse':
        p.log.info('Klassenberechnung ist in Entwicklung und wird bald verfügbar sein.')
        break
      case 'einstellungen':
        await einstellungenScreen(einstellungen)
        break
      case 'exit':
        p.outro('Auf Wiedersehen!')
        process.exit(0)
    }
  }
}
