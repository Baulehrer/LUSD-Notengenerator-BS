import * as p from '@clack/prompts'
import { BerufeLoader } from '../import/berufe-loader'
import { einzelfallBerechnung } from './screens/einzelfall'
import { klassenberechnung } from './screens/klassenberechnung'
import { showIntro } from './intro'

const DATA_FILE = 'data/BS_Schulformen_Berufe_Lernfelder.xlsx'

export async function main() {
  await showIntro()

  p.intro('🎓 LUSD Notengenerator')

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
        { value: 'klasse', label: '📊 Klassenberechnung (Abschlusszeugnis)', hint: 'LUSD-Export importieren' },
        { value: 'exit', label: '❌ Beenden', hint: 'Programm schließen' }
      ]
    })
    
    if (p.isCancel(action)) {
      p.outro('Auf Wiedersehen!')
      process.exit(0)
    }
    
    switch (action) {
      case 'einzelfall':
        await einzelfallBerechnung(berufeLoader)
        break
      case 'klasse':
        await klassenberechnung(berufeLoader)
        break
      case 'exit':
        p.outro('Auf Wiedersehen!')
        process.exit(0)
    }
  }
}
