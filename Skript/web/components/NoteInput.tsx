import type React from 'react'
import { useCallback } from 'react'

interface NoteInputProps {
  value: number | null
  onChange: (note: number | null) => void
  disabled?: boolean
}

function noteClass(note: number | null): string {
  if (note === null || note === 0) return 'note-0'
  return `note-${note}`
}

export function NoteInput({ value, onChange, disabled }: NoteInputProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const v = parseInt(e.target.value, 10)
      onChange(v === 0 ? null : v)
    },
    [onChange],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLSelectElement>) => {
      const key = e.key
      if (key >= '0' && key <= '6') {
        e.preventDefault()
        const v = parseInt(key, 10)
        onChange(v === 0 ? null : v)
      }
    },
    [onChange],
  )

  return (
    <select
      value={value ?? 0}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      className={noteClass(value)}
    >
      <option value={0}>--</option>
      <option value={1}>1</option>
      <option value={2}>2</option>
      <option value={3}>3</option>
      <option value={4}>4</option>
      <option value={5}>5</option>
      <option value={6}>6</option>
    </select>
  )
}
