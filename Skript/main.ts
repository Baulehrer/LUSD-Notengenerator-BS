import { main } from './tui/app'

main().catch(async (error) => {
  console.error('\n❌ Fehler:', error?.message ?? error)
  console.error('\nDrücke Enter zum Beenden...')
  await new Promise<void>(resolve => {
    process.stdin.once('data', () => resolve())
    process.stdin.resume()
  })
  process.exit(1)
})