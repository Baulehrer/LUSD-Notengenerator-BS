# LUSD Notengenerator

CLI-Tool zur Berechnung und zum Export von Schülernoten an deutschen Berufsschulen.

## Features

- **Einzelfallberechnung:** Manuelle Eingabe für Abgangszeugnisse
- **Klassenberechnung:** Import von LUSD-Exporten für Abschlusszeugnisse
- **PDF-Export:** Generierung von Zeugnis-PDFs

## Installation

```bash
bun install
```

## Benutzung

```bash
bun run src/main.ts
```

## Projektstruktur

```
src/
├── main.ts              # Einstiegspunkt
├── core/
│   └── grades.ts        # Notenberechnung (BBU, Allgemeine Fächer)
├── import/
│   ├── berufe-loader.ts # Berufe-Daten aus Excel laden
│   └── lusd-parser.ts   # LUSD-Export-Dateien parsen
├── export/
│   └── pdf.ts           # PDF-Generierung
├── tui/
│   ├── app.ts           # Hauptmenü
│   └── screens/         # Einzelne Bildschirme
└── types/
    └── index.ts         # Gemeinsame Typdefinitionen
```

## Daten

Die Datei `data/BS_Schulformen_Berufe_Lernfelder.xlsx` muss vorhanden sein und enthält die Berufe mit ihren Lernfeldern und Stundenanteilen.

## Tests

```bash
bun test
```

## Lizenz

MIT