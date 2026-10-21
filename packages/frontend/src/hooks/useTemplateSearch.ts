import { useEffect, useState } from 'react'

interface UseTemplateSearchResult {
  templateIds: string[]
  loading: boolean
  error: Error | null
}

async function fetchTemplateSearch(
  query: string,
  signal: AbortSignal,
): Promise<string[]> {
  const response = await fetch('/api/templates/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ query }),
    signal,
  })

  if (!response.ok) {
    throw new Error(`Failed to search templates: ${response.status}`)
  }

  const result = await response.json()
  return result.data.templateIds as string[]
}

/**
 * Ranks templates against a free-text query with Jev, best match first.
 */
export function useTemplateSearch(query: string): UseTemplateSearchResult {
  const [templateIds, setTemplateIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setTemplateIds([])
      setLoading(false)
      setError(null)
      return
    }

    // Aborting stops a slow earlier response from overwriting a newer query.
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    fetchTemplateSearch(trimmed, controller.signal)
      .then((ids) => {
        setTemplateIds(ids)
        setLoading(false)
      })
      .catch((err) => {
        if (controller.signal.aborted) {
          return
        }
        setTemplateIds([])
        setError(err instanceof Error ? err : new Error(String(err)))
        setLoading(false)
      })

    return () => controller.abort()
  }, [query])

  return { templateIds, loading, error }
}

export default useTemplateSearch
