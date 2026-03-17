import PDFDocument from 'pdfkit'
import { join } from 'path'
import type { Berechnungsergebnis, KlassenErgebnis, Beruf } from '../types'
import { DEFAULT_HALBJAHR_STUNDEN } from '../config/einstellungen'

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
  options?: { beruf?: Beruf; halbjahre?: string[]; halbjahrStunden?: Record<string, number> }
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

// ── BBU horizontal: LFs als Spalten, 3 Zeilen (Name/Stunden/Note) ──
function renderBBUHorizontal(
  doc: PDFKit.PDFDocument,
  y: number,
  schueler: import('../types').Schueler,
  berufData: Beruf | undefined
): { y: number; gewichtung: number; stunden: number } {
  // Collect active LF rows
  type LFRow = { lf: string; stunden: number; note: number }
  const rows: LFRow[] = []
  for (const [lf, eintraege] of schueler.noten.lernfelder) {
    const stunden = berufData?.lernfelder.get(lf) ?? 0
    if (stunden === 0) continue
    const latest = [...eintraege].reverse().find(n => n.note !== null && n.note! > 0)
    if (!latest) continue
    rows.push({ lf, stunden, note: latest.note! })
  }

  if (rows.length === 0) return { y, gewichtung: 0, stunden: 0 }

  // Dynamic column width: fit all into one row if possible
  const maxX = 555
  const startX = 50
  const availW = maxX - startX
  const colW = Math.max(30, Math.floor(availW / Math.min(rows.length, 12)))
  const rowsPerGroup = Math.floor(availW / colW)

  // Split into groups
  for (let g = 0; g * rowsPerGroup < rows.length; g++) {
    const group = rows.slice(g * rowsPerGroup, (g + 1) * rowsPerGroup)
    if (y > 700) { doc.addPage(); y = 40 }

    // Row 1: LF names (header background)
    doc.rect(startX, y, group.length * colW, 13).fillColor('#eeeeee').fill()
    doc.fillColor('black').fontSize(7).font('Helvetica-Bold')
    for (let i = 0; i < group.length; i++) {
      doc.text(group[i]!.lf, startX + i * colW + 2, y + 2, { width: colW - 4, lineBreak: false })
    }
    y += 13

    // Row 2: Stunden
    doc.fontSize(7).font('Helvetica').fillColor('#444444')
    for (let i = 0; i < group.length; i++) {
      doc.text(`${group[i]!.stunden}h`, startX + i * colW + 2, y + 2, { width: colW - 4, lineBreak: false })
    }
    y += 12

    // Row 3: Noten
    doc.fontSize(9).font('Helvetica-Bold').fillColor('black')
    for (let i = 0; i < group.length; i++) {
      doc.text(String(group[i]!.note), startX + i * colW + 2, y + 2, { width: colW - 4, lineBreak: false })
    }
    y += 14

    hline(doc, y, startX, startX + group.length * colW)
    y += 6
  }

  const totalGewichtung = rows.reduce((s, r) => s + r.note * r.stunden, 0)
  const totalStunden = rows.reduce((s, r) => s + r.stunden, 0)
  return { y, gewichtung: totalGewichtung, stunden: totalStunden }
}

// ── Allg. Fächer horizontal: Fächer als Zeilen, HJ als Spalten ──
function renderAllgFaecherHorizontal(
  doc: PDFKit.PDFDocument,
  y: number,
  schueler: import('../types').Schueler,
  halbjahre: string[],
  stundenMap: Record<string, number>
): number {
  if (halbjahre.length === 0) return y

  const startX = 50
  const fachColW = 100
  const hjColW = 42
  const endnoteColW = 65
  const vorschlagColW = 55

  // Header row
  doc.rect(startX, y, fachColW + halbjahre.length * hjColW + endnoteColW + vorschlagColW, 13)
    .fillColor('#eeeeee').fill()
  doc.fillColor('black').fontSize(7).font('Helvetica-Bold')

  let x = startX
  doc.text('Fach', x + 2, y + 2, { width: fachColW - 4, lineBreak: false })
  x += fachColW
  for (const hj of halbjahre) {
    doc.text(hj, x + 2, y + 2, { width: hjColW - 4, lineBreak: false })
    x += hjColW
  }
  doc.text('Endnote', x + 2, y + 2, { width: endnoteColW - 4, lineBreak: false })
  x += endnoteColW
  doc.text('Vorschlag', x + 2, y + 2, { width: vorschlagColW - 4, lineBreak: false })
  y += 13

  // One row per Fach
  for (const [fach, eintraege] of schueler.noten.allgemeineFaecher) {
    // Check if this Fach has any notes
    const hasNotes = eintraege.some((e, i) => {
      const hj = halbjahre[i]
      if (!hj) return false
      const stunden = stundenMap[hj] ?? 0
      return e.note !== null && e.note !== undefined && e.note > 0 && stunden > 0
    })
    if (!hasNotes) continue

    if (y > 720) { doc.addPage(); y = 40 }

    let fachGewichtung = 0
    let fachStunden = 0

    doc.fontSize(8).font('Helvetica')
    x = startX
    doc.text(FACH_NAMEN[fach] ?? fach, x + 2, y + 2, { width: fachColW - 4, lineBreak: false })
    x += fachColW

    for (let i = 0; i < halbjahre.length; i++) {
      const hj = halbjahre[i]!
      const eintrag = eintraege[i]
      const stunden = stundenMap[hj] ?? 0
      const note = eintrag?.note

      if (note !== null && note !== undefined && note > 0 && stunden > 0) {
        doc.font('Helvetica-Bold')
        doc.text(String(note), x + 2, y + 2, { width: hjColW - 4, lineBreak: false })
        doc.font('Helvetica')
        fachGewichtung += note * stunden
        fachStunden += stunden
      } else {
        doc.fillColor('#aaaaaa')
        doc.text('–', x + 2, y + 2, { width: hjColW - 4, lineBreak: false })
        doc.fillColor('black')
      }
      x += hjColW
    }

    // Endnote + Vorschlag
    if (fachStunden > 0) {
      const endnote = fachGewichtung / fachStunden
      const vorschlag = Math.round(endnote)
      doc.font('Helvetica-Bold').fillColor('black')
      doc.text(`${endnote.toFixed(2)}`, x + 2, y + 2, { width: endnoteColW - 4, lineBreak: false })
      x += endnoteColW
      doc.text(String(vorschlag), x + 2, y + 2, { width: vorschlagColW - 4, lineBreak: false })
      doc.font('Helvetica')
    }

    y += 14
    hline(doc, y, startX, startX + fachColW + halbjahre.length * hjColW + endnoteColW + vorschlagColW)
    y += 3
  }

  return y
}

function renderEinzelfall(
  doc: PDFKit.PDFDocument,
  ergebnis: Berechnungsergebnis,
  options?: { beruf?: Beruf; halbjahre?: string[]; halbjahrStunden?: Record<string, number> }
): void {
  const { schueler } = ergebnis
  const berufData = options?.beruf
  const halbjahre = options?.halbjahre ?? schueler.halbjahre ?? []
  const stundenMap = options?.halbjahrStunden ?? DEFAULT_HALBJAHR_STUNDEN

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

  // ── BBU-Tabelle (horizontal) ───────────────────────────────────
  y = renderSectionHeader(doc, y, 'Berufsbezogener Unterricht (BBU)')

  const bbuResult = renderBBUHorizontal(doc, y, schueler, berufData)
  y = bbuResult.y

  const bbuRaw = bbuResult.stunden > 0 ? bbuResult.gewichtung / bbuResult.stunden : 0
  const bbuGerundet = Math.round(bbuRaw)
  doc.fontSize(9).font('Helvetica-Oblique').fillColor('#333333')
    .text(`BBU-Note: ${bbuRaw.toFixed(2)} -> gerundet: ${bbuGerundet}`, 50, y)
  doc.fillColor('black')
  y += 18

  // ── Allgemeine Fächer (horizontal) ────────────────────────────
  y = renderSectionHeader(doc, y, 'Allgemeinbildende Fächer')
  y = renderAllgFaecherHorizontal(doc, y, schueler, halbjahre, stundenMap)
  y += 10

  // ── Ergebnis ───────────────────────────────────────────────────
  y = renderSectionHeader(doc, y, 'Ergebnis')

  const totalGewichtung = ergebnis.gewichtungBBU + ergebnis.gewichtungAllg
  const totalStunden = ergebnis.stundenBBU + ergebnis.stundenAllg
  const gesamtnoteFloor2 = totalStunden > 0 ? floorTwo(totalGewichtung / totalStunden) : 0

  doc.fontSize(10).font('Helvetica')
  doc.text(`BBU-Note:    ${ergebnis.bbuNoteGerundet}`, 50, y)
  doc.text('(ganzzahlig, kaufmaennisch gerundet)', 200, y, { color: '#555555' } as any)
  y += 16
  doc.text(`Gesamtnote:  ${gesamtnoteFloor2.toFixed(2)}`, 50, y)
  doc.text('(2 Nachkommastellen, nur abgerundet)', 200, y, { color: '#555555' } as any)
  y += 14
  doc.fontSize(8).font('Helvetica-Oblique').fillColor('#666666')
    .text(`Berechnung: (${totalGewichtung.toFixed(1)} Gew.) / (${totalStunden} h) = ${(totalGewichtung / totalStunden).toFixed(4)}`, 50, y)
  doc.fillColor('black')
  y += 24

  // ── Klassenlehrer ───────────────────────────────────────────────
  if (y < 700) y = 700

  const datumStr = new Date().toLocaleDateString('de-DE')
  doc.fontSize(10).font('Helvetica')
  doc.text('Fuer die Richtigkeit:', 50, y)
  y += 20
  doc.text(`Datum: ${datumStr}`, 50, y)
  y += 30
  doc.text('_'.repeat(32), 50, y)
  y += 14
  doc.fontSize(9).text('Klassenlehrer/in', 50, y)
}

function renderSectionHeader(doc: PDFKit.PDFDocument, y: number, title: string): number {
  doc.rect(40, y, 515, 16).fillColor('#dddddd').fill()
  doc.fillColor('black').fontSize(9).font('Helvetica-Bold')
    .text(`  ${title}`, 42, y + 3, { width: 511 })
  return y + 20
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
