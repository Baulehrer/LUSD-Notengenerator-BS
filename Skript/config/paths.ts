import { dirname, join } from 'node:path'

// Compiled Bun binary: argv[1] starts with /$bunfs/, execPath = actual exe
// Dev mode (bun main.ts): argv[1] ends with .ts, execPath = /usr/bin/bun
const isCompiled = process.argv[1]?.startsWith('/$bunfs/') ?? false

export const ROOT_DIR = isCompiled ? dirname(process.execPath) : join(import.meta.dir, '..', '..')

export const INPUT_DIR = join(ROOT_DIR, 'Input')
export const OUTPUT_DIR = join(ROOT_DIR, 'Output')
export const DATA_FILE = join(INPUT_DIR, 'BS_Schulformen_Berufe_Lernfelder.xlsx')
export const CONFIG_PATH = join(INPUT_DIR, 'einstellungen.json')
