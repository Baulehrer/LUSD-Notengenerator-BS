import React, { useState, useCallback, useRef, useEffect } from 'react'
import { searchBerufe } from '../lib/api'

interface Props {
  value: string
  onSelect: (name: string) => void
}

export function BerufSearch({ value, onSelect }: Props) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout>>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setQuery(value) }, [value])

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 1) { setResults([]); setOpen(false); return }
    try {
      const res = await searchBerufe(q)
      setResults(res)
      setOpen(res.length > 0)
      setActiveIndex(0)
    } catch { /* ignore */ }
  }, [])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setQuery(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => doSearch(v), 200)
  }, [doSearch])

  const handleSelect = useCallback((name: string) => {
    setQuery(name)
    setOpen(false)
    onSelect(name)
  }, [onSelect])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault()
      handleSelect(results[activeIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }, [open, results, activeIndex, handleSelect])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Clear pending debounce timer on unmount
  useEffect(() => {
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [])

  return (
    <div className="beruf-search" ref={containerRef}>
      <input
        type="text"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (results.length > 0) setOpen(true) }}
        placeholder="Beruf suchen..."
      />
      {open && (
        <div className="beruf-dropdown">
          {results.map((name, i) => (
            <div
              key={name}
              className={`beruf-dropdown-item ${i === activeIndex ? 'active' : ''}`}
              onClick={() => handleSelect(name)}
              onMouseEnter={() => setActiveIndex(i)}
            >
              {name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
