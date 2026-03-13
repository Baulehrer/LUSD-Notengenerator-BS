import PDFDocument from 'pdfkit'
import type { Berechnungsergebnis, KlassenErgebnis } from '../types'

export async function generatePDF(ergebnisse: Berechnungsergebnis[], outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: 'Notenübersicht',
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
    doc.fontSize(18).font('Helvetica-Bold').text('Notenübersicht', { align: 'center' })
    doc.moveDown(2)

    for (const ergebnis of ergebnisse) {
      renderSchueler(doc, ergebnis)
      if (ergebnisse.indexOf(ergebnis) < ergebnisse.length - 1) {
        doc.addPage()
      }
    }

    doc.end()
  })
}

function renderSchueler(doc: PDFKit.PDFDocument, ergebnis: Berechnungsergebnis): void {
  const { schueler } = ergebnis

  // Header info
  doc.fontSize(12).font('Helvetica-Bold')
  doc.text(`${schueler.nachname}, ${schueler.vorname}`)
  doc.fontSize(10).font('Helvetica')
  doc.text(`Klasse: ${schueler.klasse}`)
  doc.text(`Beruf: ${schueler.beruf}`)
  doc.moveDown()

  // Results table
  const tableTop = doc.y
  const colWidth = 120
  const rowHeight = 20

  // Table header
  doc.font('Helvetica-Bold').fontSize(10)
  doc.text('Fach/Bereich', 50, tableTop, { width: colWidth })
  doc.text('Note', 50 + colWidth, tableTop, { width: 60 })
  doc.text('Gerundet', 50 + colWidth + 60, tableTop, { width: 60 })
  doc.text('Stunden', 50 + colWidth + 120, tableTop, { width: 60 })

  let y = tableTop + rowHeight
  doc.font('Helvetica')

  // BBU row
  doc.text('BBU (Berufsbezug)', 50, y, { width: colWidth })
  doc.text(ergebnis.bbuNote.toFixed(2), 50 + colWidth, y, { width: 60 })
  doc.text(String(ergebnis.bbuNoteGerundet), 50 + colWidth + 60, y, { width: 60 })
  doc.text(String(ergebnis.stundenBBU), 50 + colWidth + 120, y, { width: 60 })
  y += rowHeight

  // Allgemeine Fächer
  const fachNamen: Record<string, string> = {
    D: 'Deutsch',
    POWI: 'Politik & Wirtschaft',
    RKA: 'Religion',
    SPO: 'Sport',
    ENG: 'Englisch'
  }

  for (const [fach, data] of ergebnis.allgemeineFaecherNoten) {
    if (data.note > 0) {
      doc.text(fachNamen[fach] || fach, 50, y, { width: colWidth })
      doc.text(data.note.toFixed(2), 50 + colWidth, y, { width: 60 })
      doc.text(String(data.noteGerundet), 50 + colWidth + 60, y, { width: 60 })
      y += rowHeight
    }
  }

  // Total
  y += 10
  doc.font('Helvetica-Bold')
  doc.text('Gesamtnote', 50, y, { width: colWidth })
  doc.text(ergebnis.gesamtnote.toFixed(2), 50 + colWidth, y, { width: 60 })
  doc.text(String(ergebnis.gesamtnoteGerundet), 50 + colWidth + 60, y, { width: 60 })
  
  // Signature lines
  y += 40
  doc.font('Helvetica').fontSize(10)
  doc.text('_'.repeat(30), 50, y)
  doc.text('_'.repeat(30), 250, y)
  y += 15
  doc.fontSize(9)
  doc.text('Lehrer/in', 50, y)
  doc.text('Schulleitung', 250, y)
  y += 20
  doc.text(`Datum: ${new Date().toLocaleDateString('de-DE')}`, 50, y)
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
