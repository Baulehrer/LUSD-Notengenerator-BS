const MATRIX_CHARS = '╠╬╗╚╔═╦╣╩╤╧╟╢╥╨░▒▓█▄▀■□▪▫ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&'

const FBS_ASCII = [
  '███████╗██████╗ ███████╗',
  '██╔════╝██╔══██╗██╔════╝',
  '█████╗  ██████╔╝███████╗',
  '██╔══╝  ██╔══██╗╚════██║',
  '██║     ██████╔╝███████║',
  '╚═╝     ╚═════╝ ╚══════╝',
]

function green(s: string) { return `\x1b[32m${s}\x1b[0m` }
function brightGreen(s: string) { return `\x1b[92m${s}\x1b[0m` }
function red(s: string) { return `\x1b[31m${s}\x1b[0m` }
function cyan(s: string) { return `\x1b[36m${s}\x1b[0m` }
function bold(s: string) { return `\x1b[1m${s}\x1b[0m` }

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function randomChar(): string {
  return MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)]!
}

function renderMatrixFrame(cols: number, rows: number): void {
  process.stdout.write('\x1b[H')
  const lines: string[] = []
  for (let r = 0; r < rows; r++) {
    let line = ''
    for (let c = 0; c < cols; c++) {
      const ch = randomChar()
      if (Math.random() < 0.1) {
        line += brightGreen(ch)
      } else {
        line += green(ch)
      }
    }
    lines.push(line)
  }
  process.stdout.write(lines.join('\n') + '\n')
}

export async function showIntro() {
  const cols = process.stdout.columns || 80
  const rows = process.stdout.rows || 24

  process.stdout.write('\x1b[?25l') // hide cursor
  process.stdout.write('\x1b[2J\x1b[H') // clear screen

  // Phase 1: Matrix rain (20 frames, fullscreen)
  for (let i = 0; i < 20; i++) {
    renderMatrixFrame(cols, rows)
    await sleep(50)
  }

  // Phase 2: Clear → FBS ASCII-Art centered
  process.stdout.write('\x1b[2J\x1b[H')

  const logoWidth = 24  // raw char width of FBS_ASCII lines
  const indent = ' '.repeat(Math.max(0, Math.floor((cols - logoWidth) / 2)))
  const vertPad = Math.max(0, Math.floor((rows - FBS_ASCII.length) / 2))

  // Vertical centering
  for (let i = 0; i < vertPad; i++) {
    process.stdout.write('\n')
  }

  for (const line of FBS_ASCII) {
    const coloredLine = line.split('').map(ch => {
      if ('╔╗╚╝╠╣╦╩╬═║'.includes(ch)) return cyan(ch)
      if (ch === '█') return bold(red(ch))
      return ch
    }).join('')
    process.stdout.write(indent + coloredLine + '\n')
  }

  await sleep(800)

  process.stdout.write('\x1b[?25h') // show cursor
  process.stdout.write('\x1b[2J\x1b[H')
}
