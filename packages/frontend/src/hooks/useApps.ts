import type { IApp } from '@plumber/types'

import { useEffect, useState } from 'react'

interface UseAppsResult {
  data: IApp[]
  loading: boolean
  error: Error | null
}

// Module-level cache for apps data
// This persists across component mounts and is shared across all hook instances
const appsCache: {
  all: IApp[] | null
  fetchPromise: Promise<IApp[]> | null
} = {
  all: null,
  fetchPromise: null,
}

async function fetchApps(): Promise<IApp[]> {
  const response = await fetch('/api/apps', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Include cookies for authentication
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch apps: ${response.status}`)
  }

  const result = await response.json()
  return result.data as IApp[]
}

export function useApps(): UseAppsResult {
  const [data, setData] = useState<IApp[]>(appsCache.all ?? [])
  const [loading, setLoading] = useState(!appsCache.all)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (appsCache.all) {
      setData(appsCache.all)
      setLoading(false)
      return
    }

    const doFetch = async () => {
      try {
        setLoading(true)

        // Deduplicate concurrent fetches
        if (!appsCache.fetchPromise) {
          appsCache.fetchPromise = fetchApps()
        }

        const apps = await appsCache.fetchPromise

        appsCache.all = apps
        appsCache.fetchPromise = null

        setData(apps)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)))
        appsCache.fetchPromise = null
      } finally {
        setLoading(false)
      }
    }

    doFetch()
  }, [])

  return { data, loading, error }
}

export default useApps
