import * as p from '@clack/prompts'
import type { BerufeLoader } from '../import/berufe-loader'

/**
 * Reusable typeahead search for Berufe.
 * Returns the selected Beruf name, or undefined if cancelled.
 */
export async function selectBerufWithSearch(
  berufeLoader: BerufeLoader,
  currentBeruf?: string
): Promise<string | undefined> {
  while (true) {
    const query = await p.text({
      message: 'Beruf suchen',
      placeholder: currentBeruf ?? 'z.B. Maurer',
    })

    if (p.isCancel(query)) return undefined

    const treffer = berufeLoader.searchBerufe(query as string).slice(0, 20)

    if (treffer.length === 0) {
      p.log.warn(`Kein Beruf gefunden für "${query}"`)
      continue
    }

    const selected = await p.select({
      message: `${treffer.length} Treffer für "${query}"`,
      options: [
        ...treffer.map(b => ({ value: b, label: b })),
        { value: '__new__', label: '↩ Neue Suche' },
        { value: '__cancel__', label: '✕ Abbrechen' },
      ]
    })

    if (p.isCancel(selected) || selected === '__cancel__') return undefined
    if (selected === '__new__') continue

    return selected as string
  }
}
