export interface NoteScaleResult {
  note: number | null   // null = nicht unterrichtet
  action: 'confirm' | 'back'
}

const NOTES = [1, 2, 3, 4, 5, 6] as const

function render(
  label: string,
  selected: number | null,
  progress?: { current: number; total: number }
): string {
  const parts: string[] = []

  for (const n of NOTES) {
    if (n === selected) {
      parts.push(`\x1b[1;36m▸${n}◂\x1b[0m`)
    } else {
      parts.push(` ${n} `)
    }
  }

  const zeroLabel = selected === 0 ? '\x1b[1;36m▸0◂\x1b[0m' : ' 0 '
  const backLabel = '\x1b[2m ← \x1b[0m'

  const progressStr = progress
    ? `\x1b[2m[${progress.current}/${progress.total}]\x1b[0m `
    : ''

  return `  ${progressStr}${label}:\n  ${parts.join('  ')}    ${zeroLabel}   ${backLabel}`
}

export async function promptNoteScale(
  label: string,
  initialNote: number,
  progress?: { current: number; total: number }
): Promise<NoteScaleResult> {
  return new Promise((resolve) => {
    let selected: number | null = initialNote >= 1 && initialNote <= 6 ? initialNote : 3

    // Initial draw with cursor save
    process.stdout.write('\x1b[s')
    process.stdout.write(render(label, selected, progress))

    const draw = () => {
      process.stdout.write('\x1b[u')   // Restore cursor to saved position
      process.stdout.write('\x1b[J')   // Clear from cursor to end of screen
      process.stdout.write(render(label, selected, progress))
    }

    const stdin = process.stdin
    const wasRaw = stdin.isRaw
    stdin.setRawMode(true)
    stdin.resume()

    const cleanup = () => {
      stdin.removeListener('data', onData)
      stdin.setRawMode(wasRaw)
      if (!wasRaw) stdin.pause()
      process.stdout.write('\n')
    }

    const onData = (data: Buffer) => {
      const key = data.toString()

      // Number keys 1-6
      if (key >= '1' && key <= '6') {
        selected = parseInt(key, 10)
        draw()
        return
      }

      // 0 = nicht unterrichtet
      if (key === '0') {
        selected = 0
        draw()
        return
      }

      // Enter = confirm
      if (key === '\r' || key === '\n') {
        cleanup()
        resolve({
          note: selected === 0 ? null : selected,
          action: 'confirm'
        })
        return
      }

      // Escape or Backspace = back
      if (key === '\x1b' || key === '\x7f' || key === '\b') {
        if (key === '\x1b') {
          // Wait briefly for potential escape sequence
          const timeout = setTimeout(() => {
            cleanup()
            resolve({ note: null, action: 'back' })
          }, 50)

          const checkSequence = (next: Buffer) => {
            clearTimeout(timeout)
            stdin.removeListener('data', checkSequence)
            const seq = next.toString()

            // Left arrow = move selection left
            if (seq === '[D') {
              if (selected === null || selected === 0) {
                selected = 6
              } else if (selected > 1) {
                selected = selected - 1
              } else {
                selected = 0
              }
              draw()
              return
            }

            // Right arrow = move selection right
            if (seq === '[C') {
              if (selected === 0) {
                selected = 1
              } else if (selected !== null && selected < 6) {
                selected = selected + 1
              } else {
                selected = 0
              }
              draw()
              return
            }

            // Up arrow = back
            if (seq === '[A') {
              cleanup()
              resolve({ note: null, action: 'back' })
              return
            }

            // Down arrow = confirm
            if (seq === '[B') {
              cleanup()
              resolve({
                note: selected === 0 ? null : selected,
                action: 'confirm'
              })
              return
            }

            // Other escape sequence — treat as Escape
            cleanup()
            resolve({ note: null, action: 'back' })
          }

          stdin.once('data', checkSequence)
          return
        }

        // Plain backspace
        cleanup()
        resolve({ note: null, action: 'back' })
        return
      }

      // Ctrl+C
      if (key === '\x03') {
        cleanup()
        resolve({ note: null, action: 'back' })
        return
      }
    }

    stdin.on('data', onData)
  })
}
