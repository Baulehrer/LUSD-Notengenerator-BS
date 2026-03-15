const VERSION = '1.0.0'
const AUTHOR = 'Stephan Kaufmann'
const TITLE = 'LUSD Notengenerator (BS)'

const WIDTH = 44

function cyan(s: string) { return `\x1b[36m${s}\x1b[0m` }
function white(s: string) { return `\x1b[97m${s}\x1b[0m` }
function bold(s: string) { return `\x1b[1m${s}\x1b[0m` }

function pad(text: string, totalWidth: number) {
  const spaces = totalWidth - text.length
  return text + ' '.repeat(Math.max(0, spaces))
}

function renderBox(titleSoFar: string, color: (s: string) => string) {
  process.stdout.write('\x1b[H') // move to top-left
  const top    = color(`  ╔${'═'.repeat(WIDTH)}╗`)
  const empty  = color(`  ║${' '.repeat(WIDTH)}║`)
  const titleLine = color(`  ║    `) + bold(color(pad(titleSoFar, WIDTH - 4))) + color(`║`)
  const versionLine = color(`  ║    ${pad(`Version ${VERSION}`, WIDTH - 4)}║`)
  const authorLine  = color(`  ║    ${pad(`© ${AUTHOR}`, WIDTH - 4)}║`)
  const bottom = color(`  ╚${'═'.repeat(WIDTH)}╝`)

  const lines = [top, empty, titleLine, versionLine, empty, authorLine, empty, bottom]
  process.stdout.write(lines.join('\n') + '\n')
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

export async function showIntro() {
  process.stdout.write('\x1b[?25l') // hide cursor
  console.clear()
  process.stdout.write('\x1b[2J\x1b[H') // clear screen, move to top

  // Typewriter effect for title
  for (let i = 0; i <= TITLE.length; i++) {
    renderBox(TITLE.slice(0, i), cyan)
    await sleep(30)
  }

  // Flash: switch to white briefly, then back to cyan
  await sleep(150)
  renderBox(TITLE, white)
  await sleep(120)
  renderBox(TITLE, cyan)
  await sleep(120)
  renderBox(TITLE, white)
  await sleep(120)
  renderBox(TITLE, cyan)

  await sleep(400)
  process.stdout.write('\x1b[?25h') // show cursor
  console.clear()
}
