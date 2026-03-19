export interface NoteScaleResult {
  note: number | null   // null = nicht unterrichtet
  action: 'confirm' | 'back'
}

const NOTES = [1, 2, 3, 4, 5, 6] as const

function render(label: string, selected: number | null): string {
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

  return `  ${label}:\n  ${parts.join('  ')}    ${zeroLabel}   ${backLabel}`
}

export async function promptNoteScale(
  label: string,
  initialNote: number  // 1-6, default 3
): Promise<NoteScaleResult> {
  return new Promise((resolve) => {
    let selected: number | null = initialNote >= 1 && initialNote <= 6 ? initialNote : 3

    const draw = () => {
      // Move cursor up and clear if not first draw
      process.stdout.write('\x1b[2K\x1b[1A\x1b[2K\r')
      process.stdout.write(render(label, selected) + '\n')
    }

    // Initial draw
    process.stdout.write('\n') // Reserve line
    process.stdout.write(render(label, selected) + '\n')

    const stdin = process.stdin
    const wasRaw = stdin.isRaw
    stdin.setRawMode(true)
    stdin.resume()

    const cleanup = () => {
      stdin.removeListener('data', onData)
      stdin.setRawMode(wasRaw)
      if (!wasRaw) stdin.pause()
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
        // Check if it's an arrow key sequence (starts with \x1b[)
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
