const MATRIX_CHARS = '╠╬╗╚╔═╦╣╩╤╧╟╢╥╨░▒▓█▄▀■□▪▫ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&'
const COLS = 60
const ROWS = 16

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

function renderMatrixFrame(): void {
  process.stdout.write('\x1b[H')
  const lines: string[] = []
  for (let r = 0; r < ROWS; r++) {
    let line = ''
    for (let c = 0; c < COLS; c++) {
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
  process.stdout.write('\x1b[?25l') // hide cursor
  process.stdout.write('\x1b[2J\x1b[H') // clear screen

  // Phase 1: Matrix rain (20 frames)
  for (let i = 0; i < 20; i++) {
    renderMatrixFrame()
    await sleep(50)
  }

  // Phase 2: Clear → FBS ASCII-Art in red/cyan
  process.stdout.write('\x1b[2J\x1b[H')

  const indent = ' '.repeat(8)
  for (const line of FBS_ASCII) {
    const coloredLine = line.split('').map(ch => {
      if ('╔╗╚╝╠╣╦╩╬═║╗╚╔╝'.includes(ch)) return cyan(ch)
      if (ch === '█') return bold(red(ch))
      return ch
    }).join('')
    process.stdout.write(indent + coloredLine + '\n')
  }

  await sleep(800)

  process.stdout.write('\x1b[?25h') // show cursor
  process.stdout.write('\x1b[2J\x1b[H')
}
