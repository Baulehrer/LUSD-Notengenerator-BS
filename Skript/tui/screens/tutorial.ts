import * as p from '@clack/prompts'
import type { BerufeLoader } from '../../import/berufe-loader'
import { calculateSchuelerNoten } from '../../core/grades'
import { DEFAULT_HALBJAHR_STUNDEN } from '../../config/einstellungen'
import type { Schueler } from '../../types'

type NavAction = 'weiter' | 'zurueck' | 'beenden'

async function nav(message = 'Navigation'): Promise<NavAction | symbol> {
  const action = await p.select({
    message,
    options: [
      { value: 'weiter', label: '→ Weiter' },
      { value: 'zurueck', label: '← Zurück' },
      { value: 'beenden', label: '✕ Tutorial beenden' },
    ]
  })
  return p.isCancel(action) ? action : action as NavAction
}

export async function tutorialScreen(berufeLoader: BerufeLoader): Promise<void> {
  console.clear()
  p.intro('📖 Tutorial — Schritt-für-Schritt Anleitung')

  let step = 0
  const maxStep = 6

  while (step >= 0 && step <= maxStep) {
    switch (step) {
      case 0: {
        p.note(
          [
            'Der LUSD Notengenerator berechnet Zeugnisnoten für',
            'Berufsschüler nach den Vorgaben der hessischen Berufsschule.',
            '',
            'Er berechnet:',
            '  • BBU-Note (Berufsbezogener Unterricht) — gewichtet nach Lernfeld-Stunden',
            '  • Allgemeine Fächer — gewichtet nach Halbjahr-Stunden',
            '  • Gesamtnote — aus BBU + allgemeinen Fächern',
            '',
            'Am Ende wird ein PDF mit allen Ergebnissen exportiert.',
          ].join('\n'),
          'Was ist der Notengenerator?'
        )
        break
      }

      case 1: {
        p.note(
          [
            'Beispiel-Schüler:',
            '',
            '  Name:     Muster, Max',
            '  Klasse:   12B101',
            '  Semester: 12/1  (Halbjahre: 10/2, 11/1, 11/2, 12/1)',
            '',
            'Der Name erscheint auf dem PDF im Format "Nachname, Vorname".',
            'Die Klasse identifiziert die Schülergruppe.',
            'Das Ausscheide-Semester bestimmt, welche Halbjahre einfließen.',
          ].join('\n'),
          'Schritt 1: Schüler-Daten'
        )
        break
      }

      case 2: {
        const beruf = berufeLoader.getBeruf('Maurer/in')
        const lfInfo = beruf
          ? Array.from(beruf.lernfelder.entries())
              .filter(([_, s]) => s > 0)
              .map(([lf, s]) => `  ${lf}: ${s}h`)
              .join('\n')
          : '  (Beruf "Maurer/in" nicht in der Datenbank gefunden)'

        p.note(
          [
            'Jeder Beruf hat definierte Lernfelder (LF) mit Stundenzahlen.',
            'Diese Stunden bestimmen die Gewichtung der BBU-Note.',
            '',
            'Beispiel: Maurer/in',
            lfInfo,
            '',
            'Mehr Stunden = mehr Einfluss auf die BBU-Note.',
          ].join('\n'),
          'Schritt 2: Beruf & Lernfelder'
        )
        break
      }

      case 3: {
        p.note(
          [
            'Für jedes Lernfeld wird eine Note (1-6) eingegeben.',
            '0 = nicht unterrichtet (wird ignoriert).',
            '',
            'Beispiel-Noten für Maurer/in:',
            '  LF01 (80h):  3  →  3 × 80 = 240 Punkte',
            '  LF02 (60h):  2  →  2 × 60 = 120 Punkte',
            '  LF03 (60h):  4  →  4 × 60 = 240 Punkte',
            '',
            'BBU-Note = Σ Punkte / Σ Stunden',
            '         = (240 + 120 + 240) / (80 + 60 + 60)',
            '         = 600 / 200 = 3.00',
            '',
            'Die BBU-Note wird kaufmännisch auf eine ganze Zahl gerundet.',
          ].join('\n'),
          'Schritt 3: Lernfeld-Noten & BBU-Berechnung'
        )
        break
      }

      case 4: {
        p.note(
          [
            'Für jedes allgemeine Fach wird pro Halbjahr eine Note eingegeben.',
            'Die Gewichtung richtet sich nach den Halbjahr-Stunden:',
            '',
            '  10/2: 40h  |  11/1: 20h  |  11/2: 20h  |  12/1: 20h',
            '',
            'Beispiel: Deutsch mit Semester 12/1',
            '  10/2: Note 3 (40h)  →  3 × 40 = 120',
            '  11/1: Note 2 (20h)  →  2 × 20 =  40',
            '  11/2: Note 3 (20h)  →  3 × 20 =  60',
            '  12/1: Note 2 (20h)  →  2 × 20 =  40',
            '',
            '  Endnote = 260 / 100 = 2.60  →  Vorschlag: 3',
            '',
            'Die Stunden können in den Einstellungen angepasst werden.',
          ].join('\n'),
          'Schritt 4: Allgemeine Fächer & Halbjahr-Gewichtung'
        )
        break
      }

      case 5: {
        // Run an actual calculation with example data
        const beruf = berufeLoader.getBeruf('Maurer/in')
        if (beruf) {
          const exampleSchueler: Schueler = {
            nachname: 'Muster',
            vorname: 'Max',
            klasse: '12B101',
            beruf: 'Maurer/in',
            stufeSemester: '12/1',
            halbjahre: ['10/2', '11/1', '11/2', '12/1'],
            noten: {
              lernfelder: new Map(
                Array.from(beruf.lernfelder.entries())
                  .filter(([_, s]) => s > 0)
                  .map(([lf]) => [lf, [{ note: 3, lehrer: '' }]])
              ),
              allgemeineFaecher: new Map([
                ['D', [{ note: 3, lehrer: '' }, { note: 2, lehrer: '' }, { note: 3, lehrer: '' }, { note: 2, lehrer: '' }]],
                ['POWI', [{ note: 2, lehrer: '' }, { note: 2, lehrer: '' }, { note: 3, lehrer: '' }, { note: 3, lehrer: '' }]],
                ['RKA', [{ note: 2, lehrer: '' }, { note: 3, lehrer: '' }, { note: 2, lehrer: '' }, { note: 3, lehrer: '' }]],
                ['SPO', [{ note: 1, lehrer: '' }, { note: 2, lehrer: '' }, { note: 1, lehrer: '' }, { note: 2, lehrer: '' }]],
                ['ENG', [{ note: 3, lehrer: '' }, { note: 3, lehrer: '' }, { note: 4, lehrer: '' }, { note: 3, lehrer: '' }]],
              ]),
            },
          }

          const halbjahre = ['10/2', '11/1', '11/2', '12/1']
          const ergebnis = calculateSchuelerNoten(exampleSchueler, beruf, halbjahre, DEFAULT_HALBJAHR_STUNDEN)

          p.note(
            [
              `Name:        ${ergebnis.schueler.nachname}, ${ergebnis.schueler.vorname}`,
              `Klasse:      ${ergebnis.schueler.klasse}`,
              `Beruf:       ${ergebnis.schueler.beruf}`,
              '',
              `BBU-Note:    ${ergebnis.bbuNote.toFixed(2)}  →  gerundet: ${ergebnis.bbuNoteGerundet}`,
              `Gesamtnote:  ${ergebnis.gesamtnote.toFixed(2)}  (2 NKS, abgerundet)`,
              '',
              `Stunden BBU: ${ergebnis.stundenBBU}   Stunden Allg.: ${ergebnis.stundenAllg}`,
              '',
              'Die Gesamtnote kombiniert BBU + allgemeine Fächer,',
              'jeweils gewichtet nach Stunden.',
            ].join('\n'),
            'Schritt 5: Ergebnis (Live-Berechnung mit Beispieldaten)'
          )
        } else {
          p.note('Beruf "Maurer/in" nicht gefunden — überspringe Beispielberechnung.', 'Schritt 5: Ergebnis')
        }
        break
      }

      case 6: {
        p.note(
          [
            'Das war die Übersicht! Hier noch ein paar Tipps:',
            '',
            '  📄 PDF-Export speichert im Ordner "Output/"',
            '     Dateiname: JJJJ_MM_TT_Klasse_Nachname.pdf',
            '',
            '  ⚙️  Einstellungen: Halbjahr-Stunden anpassen',
            '     und kontextuelle Tipps ein-/ausschalten',
            '',
            '  📝 Noten können nach der Berechnung noch geändert',
            '     werden — mit Vorher/Nachher-Vergleich',
            '',
            '  💡 Kontextuelle Tipps zeigen bei jedem Schritt',
            '     kurze Erklärungen (abschaltbar in Einstellungen)',
          ].join('\n'),
          'Tipps & Hinweise'
        )
        break
      }
    }

    const action = await nav()
    if (p.isCancel(action) || action === 'beenden') break
    if (action === 'zurueck') {
      step = Math.max(0, step - 1)
    } else {
      step++
    }
  }

  p.outro('Tutorial beendet — viel Erfolg!')
}
