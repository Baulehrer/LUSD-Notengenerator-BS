# LUSD Notengenerator (BS)

Zeugnisnoten-Berechnung für hessische Berufsschulen.

## Was macht das Tool?

An Berufsschulen müssen Lehrkräfte für Abgangszeugnisse gewichtete Durchschnittsnoten berechnen. Die BBU-Note (Berufsbezogener Unterricht) ergibt sich aus den Lernfeld-Noten, gewichtet nach Unterrichtsstunden. Die Gesamtnote kombiniert BBU und allgemeine Fächer. Dieses Tool übernimmt die Berechnung und erstellt ein fertiges PDF.

## Features

- **Notenberechnung** — Gewichtete Durchschnitte für BBU und Gesamtnote, nach Stundentafel
- **Alle hessischen Ausbildungsberufe** — Beruf suchen, Lernfelder und Stunden werden automatisch geladen
- **Semester-Filter** — Je nach Ausscheide-Semester werden nur die relevanten Lernfelder angezeigt
- **Schnelle Noteneingabe** — Inline-Skala mit Zifferntasten, kein Tippen nötig
- **PDF-Export** — Übersichtliches PDF mit Notenaufschlüsselung, Logos und Unterschriftsfeld
- **Entwürfe** — Eingaben werden automatisch gespeichert und können später fortgesetzt werden
- **Tutorial** — Geführter Durchlauf mit Beispieldaten, erklärt jeden Schritt
- **Tipps** — Kontextuelle Hinweise bei der Eingabe (abschaltbar)
- **Einstellungen** — Stunden pro Halbjahr und Tipps anpassen

## Geplant

- Klassenberechnung mit LUSD-Import
- Klassenübersicht und Notenverteilung

## Installation

Voraussetzung: [Bun](https://bun.sh) installiert.

```bash
cd Skript
bun install
bun run start
```

## Lizenz

MIT

## Autor

Stephan Kaufmann
