import PDFDocument from 'pdfkit'
import { join } from 'path'
import type { Berechnungsergebnis, KlassenErgebnis, Beruf } from '../types'
import { HALBJAHRE_STUNDEN } from '../types'

const ASSETS_DIR = join(import.meta.dir, '..', 'assets')
const FBS_LOGO = join(ASSETS_DIR, 'fbs-logo.png')
const LUSD_LOGO = join(ASSETS_DIR, 'lusd-logo.png')

const FACH_NAMEN: Record<string, string> = {
  D: 'Deutsch',
  POWI: 'Politik & Wirtschaft',
  RKA: 'Religion',
  SPO: 'Sport',
  ENG: 'Englisch'
}

function floorTwo(x: number): number {
  return Math.floor(x * 100) / 100
}

export async function generatePDF(
  ergebnisse: Berechnungsergebnis[],
  outputPath: string,
  options?: { beruf?: Beruf; halbjahre?: string[] }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      info: {
        Title: 'Einzelfallberechnung Zeugnisnoten',
        Author: 'LUSD Notengenerator'
      }
    })

    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks)
      Bun.write(outputPath, pdfBuffer)
        .then(() => resolve())
        .catch(reject)
    })
    doc.on('error', reject)

    for (let i = 0; i < ergebnisse.length; i++) {
      if (i > 0) doc.addPage()
      renderEinzelfall(doc, ergebnisse[i]!, options)
    }

    doc.end()
  })
}

function tryImage(doc: PDFKit.PDFDocument, path: string, opts: object): void {
  try {
    doc.image(path, opts)
  } catch {
    // Logo not found — skip silently
  }
}

function hline(doc: PDFKit.PDFDocument, y: number, x1 = 40, x2 = 555): void {
  doc.moveTo(x1, y).lineTo(x2, y).strokeColor('#888888').lineWidth(0.5).stroke()
}

function renderEinzelfall(
  doc: PDFKit.PDFDocument,
  ergebnis: Berechnungsergebnis,
  options?: { beruf?: Beruf; halbjahre?: string[] }
): void {
  const { schueler } = ergebnis
  const berufData = options?.beruf
  const halbjahre = options?.halbjahre ?? schueler.halbjahre ?? []

  // ── Header: Logos ──────────────────────────────────────────────
  const logoY = 30
  tryImage(doc, FBS_LOGO, { x: 40, y: logoY, height: 55, fit: [130, 55] })
  tryImage(doc, LUSD_LOGO, { x: 420, y: logoY + 5, height: 45, fit: [95, 45] })

  const headerBottomY = logoY + 65
  hline(doc, headerBottomY)

  // ── Titel ──────────────────────────────────────────────────────
  doc.fontSize(13).font('Helvetica-Bold')
    .text('Einzelfallberechnung Zeugnisnoten', 40, headerBottomY + 8, { align: 'center', width: 515 })

  hline(doc, headerBottomY + 26)

  // ── Schüler-Info ───────────────────────────────────────────────
  let y = headerBottomY + 34
  doc.fontSize(10).font('Helvetica')
  doc.text(`Name: ${schueler.nachname}, ${schueler.vorname}`, 40, y)
  doc.text(`Klasse: ${schueler.klasse}`, 320, y)
  y += 16
  doc.text(`Beruf: ${schueler.beruf}`, 40, y)
  doc.text(`Ausscheide-Semester: ${schueler.stufeSemester}`, 320, y)
  y += 20

  // ── BBU-Tabelle ────────────────────────────────────────────────
  y = renderSectionHeader(doc, y, 'Berufsbezogener Unterricht (BBU)')

  // Table header
  const colsBBU = { lf: 55, stunden: 65, note: 55, lehrer: 65, unterschrift: 0 }
  y = renderTableHeader(doc, y, ['LF', 'Stunden', 'Note', 'Lehrer', 'Unterschrift'], colsBBU)

  let bbuGewichtungSum = 0
  let bbuStundenSum = 0

  const lernfeldRows: Array<{ lf: string; stunden: number; note: number | null; lehrer: string }> = []

  for (const [lf, eintraege] of schueler.noten.lernfelder) {
    const stunden = berufData?.lernfelder.get(lf) ?? 0
    if (stunden === 0) continue
    const latest = [...eintraege].reverse().find(n => n.note !== null && n.note! > 0)
    if (!latest) continue
    lernfeldRows.push({ lf, stunden, note: latest.note, lehrer: latest.lehrer })
    bbuGewichtungSum += (latest.note ?? 0) * stunden
    bbuStundenSum += stunden
  }

  for (const row of lernfeldRows) {
    if (y > 720) { doc.addPage(); y = 40 }
    const cols = [
      { text: row.lf, width: colsBBU.lf },
      { text: `${row.stunden} h`, width: colsBBU.stunden },
      { text: String(row.note ?? '–'), width: colsBBU.note },
      { text: row.lehrer || '–', width: colsBBU.lehrer },
      { text: '_'.repeat(22), width: 215 }
    ]
    y = renderTableRow(doc, y, cols)
  }

  hline(doc, y)
  y += 4
  const bbuRaw = bbuStundenSum > 0 ? bbuGewichtungSum / bbuStundenSum : 0
  const bbuGerundet = Math.round(bbuRaw)
  doc.fontSize(9).font('Helvetica-Oblique')
    .text(`BBU-Note (ungewichtet): ${bbuRaw.toFixed(2)} → gerundet: ${bbuGerundet}`, 50, y)
  y += 18

  // ── Allgemeine Fächer ──────────────────────────────────────────
  y = renderSectionHeader(doc, y, 'Allgemeinbildende Fächer')

  const colsAllg = { fach: 120, hj: 55, stunden: 55, note: 45, lehrer: 55, unterschrift: 0 }
  y = renderTableHeader(doc, y, ['Fach', 'Halbjahr', 'Stunden', 'Note', 'Lehrer', 'Unterschrift'], colsAllg)

  for (const [fach, eintraege] of schueler.noten.allgemeineFaecher) {
    for (let i = 0; i < eintraege.length; i++) {
      const eintrag = eintraege[i]!
      if (eintrag.note === null || eintrag.note === 0) continue
      const hj = halbjahre[i] ?? `HJ${i + 1}`
      const stunden = HALBJAHRE_STUNDEN.get(hj) ?? 0
      if (stunden === 0) continue
      if (y > 720) { doc.addPage(); y = 40 }
      const cols = [
        { text: FACH_NAMEN[fach] ?? fach, width: colsAllg.fach },
        { text: hj, width: colsAllg.hj },
        { text: `${stunden} h`, width: colsAllg.stunden },
        { text: String(eintrag.note), width: colsAllg.note },
        { text: eintrag.lehrer || '–', width: colsAllg.lehrer },
        { text: '_'.repeat(18), width: 125 }
      ]
      y = renderTableRow(doc, y, cols)
    }
  }

  hline(doc, y)
  y += 12

  // ── Ergebnis ───────────────────────────────────────────────────
  y = renderSectionHeader(doc, y, 'Ergebnis')

  const totalGewichtung = ergebnis.gewichtungBBU + ergebnis.gewichtungAllg
  const totalStunden = ergebnis.stundenBBU + ergebnis.stundenAllg
  const gesamtnoteFloor2 = totalStunden > 0 ? floorTwo(totalGewichtung / totalStunden) : 0

  doc.fontSize(10).font('Helvetica')
  doc.text(`BBU-Note:    ${ergebnis.bbuNoteGerundet}`, 50, y)
  doc.text('(ganzzahlig, kaufmännisch gerundet)', 200, y, { color: '#555555' } as any)
  y += 16
  doc.text(`Gesamtnote:  ${gesamtnoteFloor2.toFixed(2)}`, 50, y)
  doc.text('(2 Nachkommastellen, nur abgerundet)', 200, y, { color: '#555555' } as any)
  y += 14
  doc.fontSize(8).font('Helvetica-Oblique').fillColor('#666666')
    .text(`Berechnung: (${totalGewichtung.toFixed(1)} Gew.) / (${totalStunden} h) = ${(totalGewichtung / totalStunden).toFixed(4)}`, 50, y)
  doc.fillColor('black')
  y += 18

  // ── Schulleitung ───────────────────────────────────────────────
  y = renderSectionHeader(doc, y, 'Schulleitung')

  const datumStr = new Date().toLocaleDateString('de-DE')
  doc.fontSize(10).font('Helvetica').text(`Datum: ${datumStr}`, 50, y)
  y += 24

  doc.font('Helvetica').fontSize(10)
  doc.text('_'.repeat(32), 50, y)
  doc.text('_'.repeat(32), 310, y)
  y += 14
  doc.fontSize(9)
  doc.text('Klassenlehrer/in', 50, y)
  doc.text('Schulleitung', 310, y)
}

function renderSectionHeader(doc: PDFKit.PDFDocument, y: number, title: string): number {
  doc.rect(40, y, 515, 16).fillColor('#dddddd').fill()
  doc.fillColor('black').fontSize(9).font('Helvetica-Bold')
    .text(`  ${title}`, 42, y + 3, { width: 511 })
  return y + 20
}

function renderTableHeader(doc: PDFKit.PDFDocument, y: number, headers: string[], _cols: object): number {
  doc.fontSize(8).font('Helvetica-Bold')
  let x = 50
  const widths = Object.values(_cols) as number[]
  for (let i = 0; i < headers.length; i++) {
    const w = widths[i] ?? 100
    doc.text(headers[i]!, x, y, { width: w })
    x += w
  }
  y += 14
  hline(doc, y, 50)
  return y + 3
}

function renderTableRow(doc: PDFKit.PDFDocument, y: number, cols: Array<{ text: string; width: number }>): number {
  doc.fontSize(8).font('Helvetica')
  let x = 50
  for (const col of cols) {
    doc.text(col.text, x, y, { width: col.width === 0 ? 150 : col.width, lineBreak: false })
    x += col.width === 0 ? 150 : col.width
  }
  return y + 14
}

export async function generateKlassenPDF(klassenErgebnis: KlassenErgebnis, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 30,
      info: {
        Title: `Klassenliste - ${klassenErgebnis.klasse}`,
        Author: 'LUSD Notengenerator'
      }
    })

    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks)
      Bun.write(outputPath, pdfBuffer)
        .then(() => resolve())
        .catch(reject)
    })
    doc.on('error', reject)

    // Title
    doc.fontSize(16).font('Helvetica-Bold')
    doc.text(`Klassenliste - ${klassenErgebnis.klasse}`, { align: 'center' })
    doc.fontSize(10).font('Helvetica')
    doc.text(`${klassenErgebnis.schuljahr} - ${klassenErgebnis.halbjahr}`, { align: 'center' })
    doc.moveDown(2)

    // Table header
    const tableTop = doc.y
    const cols = {
      name: 180,
      beruf: 150,
      bbu: 50,
      gesamt: 50,
      stddev: 80
    }
    let x = 30

    doc.font('Helvetica-Bold').fontSize(9)
    doc.text('Name', x, tableTop, { width: cols.name })
    x += cols.name
    doc.text('Beruf', x, tableTop, { width: cols.beruf })
    x += cols.beruf
    doc.text('BBU', x, tableTop, { width: cols.bbu })
    x += cols.bbu
    doc.text('Gesamt', x, tableTop, { width: cols.gesamt })
    x += cols.gesamt
    doc.text('Unterschrift', x, tableTop, { width: cols.stddev })

    let y = tableTop + 20
    doc.font('Helvetica').fontSize(9)

    for (const ergebnis of klassenErgebnis.schueler) {
      if (y > 750) {
        doc.addPage()
        y = 30
      }

      x = 30
      doc.text(`${ergebnis.schueler.nachname}, ${ergebnis.schueler.vorname}`, x, y, { width: cols.name })
      x += cols.name
      doc.text(ergebnis.schueler.beruf.substring(0, 25), x, y, { width: cols.beruf })
      x += cols.beruf
      doc.text(String(ergebnis.bbuNoteGerundet), x, y, { width: cols.bbu })
      x += cols.bbu
      doc.text(String(ergebnis.gesamtnoteGerundet), x, y, { width: cols.gesamt })
      x += cols.gesamt
      doc.text('_', x, y, { width: cols.stddev })

      y += 18
    }

    // Summary statistics
    y += 20
    doc.font('Helvetica-Bold').fontSize(10)
    doc.text('Zusammenfassung', 30, y)
    y += 15
    doc.font('Helvetica').fontSize(9)

    const notes = klassenErgebnis.schueler.map(s => s.gesamtnoteGerundet)
    const avg = notes.reduce((a, b) => a + b, 0) / notes.length
    const min = Math.min(...notes)
    const max = Math.max(...notes)

    doc.text(`Durchschnitt: ${avg.toFixed(2)}`, 30, y)
    doc.text(`Beste Note: ${max}`, 150, y)
    doc.text(`Schlechteste Note: ${min}`, 280, y)

    doc.end()
  })
}
