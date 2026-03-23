import { useCallback, useEffect, useRef, useState } from 'react'

const STALENESS_THRESHOLD_MS = 30 * 60 * 1000 // 30 minutes

interface PersistedData<T> {
  value: T
  timestamp: number
}

/**
 * Drop-in replacement for useState that persists to sessionStorage.
 *
 * - Synchronous read on mount (no flicker, no useEffect hydration)
 * - Writes to sessionStorage on every setState call
 * - Provides `clear()` to remove the persisted entry when done
 * - Auto-clears stale data (older than 30 minutes) to prevent old sessions from persisting
 *
 * @example
 * const [formData, setFormData, clearFormData] = usePersistedState('workflow-draft', defaultForm)
 */
export function usePersistedState<T>(
  key: string,
  initialValue: T | (() => T),
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [state, setStateInternal] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(key)
      if (stored !== null) {
        const parsed = JSON.parse(stored) as PersistedData<T>
        console.log('parsed', parsed)
        // Check if data has a timestamp and is still fresh
        if (
          parsed.timestamp &&
          Date.now() - parsed.timestamp < STALENESS_THRESHOLD_MS
        ) {
          return parsed.value
        }

        // Stale data - clear it and use initial value
        sessionStorage.removeItem(key)
      }
    } catch {
      // Corrupted data or storage unavailable — fall through
    }
    return initialValue instanceof Function ? initialValue() : initialValue
  })

  const keyRef = useRef(key)
  keyRef.current = key

  const setState = useCallback((value: T | ((prev: T) => T)) => {
    setStateInternal((prev) => {
      const next = value instanceof Function ? value(prev) : value
      try {
        const dataToStore: PersistedData<T> = {
          value: next,
          timestamp: Date.now(),
        }
        console.log('dataToStore', dataToStore)
        sessionStorage.setItem(keyRef.current, JSON.stringify(dataToStore))
      } catch {
        // Storage full or unavailable — state still updates in memory
      }
      return next
    })
  }, [])

  const clear = useCallback(() => {
    try {
      sessionStorage.removeItem(keyRef.current)
    } catch {
      // ignore
    }
  }, [])

  // If the key changes, re-read from storage
  useEffect(() => {
    keyRef.current = key
    try {
      const stored = sessionStorage.getItem(key)
      if (stored !== null) {
        const parsed = JSON.parse(stored) as PersistedData<T>

        // Check if data has a timestamp and is still fresh
        if (
          parsed.timestamp &&
          Date.now() - parsed.timestamp < STALENESS_THRESHOLD_MS
        ) {
          setStateInternal(parsed.value)
        } else {
          // Stale data - clear it
          sessionStorage.removeItem(key)
        }
      }
    } catch {
      // ignore
    }
  }, [key])

  return [state, setState, clear]
}
