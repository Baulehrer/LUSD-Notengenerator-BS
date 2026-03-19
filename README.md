# LUSD Notengenerator

Berechnet Zeugnisnoten für Berufsschüler an hessischen Berufsschulen.

## Aufgabe

Lehrkräfte an Berufsschulen müssen für Abgangszeugnisse gewichtete Durchschnittsnoten berechnen — getrennt für BBU (Berufsbezogener Unterricht, gewichtet nach Lernfeld-Stunden) und allgemeine Fächer (gewichtet nach Unterrichtsstunden pro Halbjahr). Dieses CLI-Tool automatisiert die Berechnung und erstellt ein PDF-Dokument mit der Notenaufschlüsselung.

## Features

- **Einzelfallberechnung** — Schritt-für-Schritt-Eingabe für einen Schüler mit BBU- und Gesamtnote
- **Beruf-Suche** — Fuzzy-Suche über alle hessischen Ausbildungsberufe mit Typeahead
- **LF-Kappung** — Nur Lernfelder anzeigen, die zum Ausscheide-Semester gehören
- **PDF-Export** — Professionelles PDF mit Logos, Notenaufschlüsselung und Unterschriftsfeld
- **Entwürfe** — Unfertige Eingaben werden automatisch gespeichert und können fortgesetzt werden
- **Tutorial** — Geführter Durchlauf mit Beispieldaten, erklärt jeden Berechnungsschritt
- **Kontextuelle Tipps** — Erklärungen bei jedem Eingabeschritt (abschaltbar)
- **Einstellungen** — Halbjahr-Stunden und Tutorial-Tipps konfigurieren

## Geplante Features

- **Klassenberechnung** — Import aus LUSD-Export, Berechnung für ganze Klassen
- **Weitere Berichte** — Klassenübersicht, Notenverteilung

## Installation & Start

```bash
cd Skript
bun install
bun run start
```

## Ordnerstruktur

```
Skript/              Source Code + Dependencies
  ├── core/          Notenberechnung
  ├── tui/           Terminal-UI (Screens, Tipps, Tutorial)
  ├── export/        PDF-Generierung
  ├── import/        Excel/LUSD-Parser
  ├── config/        Einstellungen
  ├── assets/        Logos (Base64 für Standalone)
  └── types/         TypeScript-Typen

Input/               Nutzerdaten (Excel, Einstellungen)
Output/              Generierte PDFs
```

## Lizenz

MIT
