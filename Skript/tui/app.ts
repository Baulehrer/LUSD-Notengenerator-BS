import * as p from '@clack/prompts'
import { BerufeLoader } from '../import/berufe-loader'
import { einzelfallBerechnung } from './screens/einzelfall'
import { einstellungenScreen } from './screens/einstellungen'
import { tutorialScreen } from './screens/tutorial'
import { showIntro } from './intro'
import { ladeEinstellungen } from '../config/einstellungen'
import { join } from 'path'

const ROOT_DIR = join(import.meta.dir, '..', '..')
const DATA_FILE = join(ROOT_DIR, 'Input', 'BS_Schulformen_Berufe_Lernfelder.xlsx')

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
    p.log.info('Bitte stelle sicher, dass die Datei "Input/BS_Schulformen_Berufe_Lernfelder.xlsx" existiert.')
    process.exit(1)
  }

  while (true) {
    const action = await p.select({
      message: 'Was möchtest du tun?',
      options: [
        { value: 'einzelfall', label: '📝 Einzelfallberechnung (Abgangszeugnis)', hint: 'Noten eingeben → berechnen → PDF exportieren' },
        { value: 'klasse', label: '📊 Klassenberechnung (Abschlusszeugnis)', hint: 'LUSD-Import für ganze Klasse — in Entwicklung' },
        { value: 'tutorial', label: '📖 Tutorial', hint: 'Schritt-für-Schritt Anleitung mit Beispieldaten' },
        { value: 'einstellungen', label: '⚙️  Einstellungen', hint: 'Gewichtung, Tutorial-Tipps' },
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
      case 'tutorial':
        await tutorialScreen(berufeLoader)
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
