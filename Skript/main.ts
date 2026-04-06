import { startServer } from './server'

startServer(3000).catch(async (error) => {
  console.error('\n Fehler:', error?.message ?? error)
  process.exit(1)
})