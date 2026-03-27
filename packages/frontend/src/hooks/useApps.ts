import type { IApp } from '@plumber/types'

import { useEffect, useMemo, useState } from 'react'

interface UseAppsOptions {
  name?: string
  onlyWithTriggers?: boolean
  onlyWithActions?: boolean
}

interface UseAppsResult {
  data: IApp[]
  loading: boolean
  error: Error | null
}

// Module-level cache for apps data
// This persists across component mounts and is shared across all hook instances
const appsCache: {
  all: IApp[] | null
  withTriggers: IApp[] | null
  withActions: IApp[] | null
  fetchPromise: Promise<IApp[]> | null
} = {
  all: null,
  withTriggers: null,
  withActions: null,
  fetchPromise: null,
}

async function fetchApps(options: UseAppsOptions = {}): Promise<IApp[]> {
  const params = new URLSearchParams()

  if (options.name) {
    params.set('name', options.name)
  }
  if (options.onlyWithTriggers) {
    params.set('onlyWithTriggers', 'true')
  }
  if (options.onlyWithActions) {
    params.set('onlyWithActions', 'true')
  }

  const queryString = params.toString()
  const url = `/api/apps${queryString ? `?${queryString}` : ''}`

  const startTime = performance.now()

  const response = await fetch(url, {
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

  const endTime = performance.now()
  // TODO: Remove this log for performance monitoring before merging
  // eslint-disable-next-line no-console
  console.log(
    `[useApps] Fetched ${result.data.length} apps in ${(
      endTime - startTime
    ).toFixed(0)}ms`,
  )

  return result.data as IApp[]
}

/**
 * Hook to fetch apps data from the REST API with caching.
 *
 * This is a replacement for the GraphQL GET_APPS query that provides:
 * - In-memory caching (shared across all component instances)
 * - Deduplication of concurrent requests
 * - Similar API to Apollo's useQuery for easy migration
 *
 * @example
 * // Get all apps
 * const { data: apps, loading } = useApps()
 *
 * // Get only apps with triggers
 * const { data: triggerApps } = useApps({ onlyWithTriggers: true })
 *
 * // Get only apps with actions
 * const { data: actionApps } = useApps({ onlyWithActions: true })
 */
export function useApps(options: UseAppsOptions = {}): UseAppsResult {
  const { name, onlyWithTriggers, onlyWithActions } = options

  const [allApps, setAllApps] = useState<IApp[] | null>(appsCache.all)
  const [loading, setLoading] = useState(!appsCache.all)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // If we have cached data and no name filter, use cache
    if (appsCache.all && !name) {
      setAllApps(appsCache.all)
      setLoading(false)
      return
    }

    // If we have a name filter, filter from cache if available
    if (name && appsCache.all) {
      const filtered = appsCache.all.filter((app) =>
        app.key.toLowerCase().includes(name.toLowerCase()),
      )
      setAllApps(filtered)
      setLoading(false)
      return
    }

    // Fetch from API
    const doFetch = async () => {
      try {
        setLoading(true)

        // Deduplicate concurrent fetches
        if (!appsCache.fetchPromise) {
          appsCache.fetchPromise = fetchApps()
        }

        const apps = await appsCache.fetchPromise

        // Cache the result
        appsCache.all = apps
        appsCache.withTriggers = apps.filter((app) => app.triggers?.length)
        appsCache.withActions = apps.filter((app) => app.actions?.length)
        appsCache.fetchPromise = null

        // Apply name filter if needed
        if (name) {
          const filtered = apps.filter((app) =>
            app.key.toLowerCase().includes(name.toLowerCase()),
          )
          setAllApps(filtered)
        } else {
          setAllApps(apps)
        }

        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)))
        appsCache.fetchPromise = null
      } finally {
        setLoading(false)
      }
    }

    doFetch()
  }, [name])

  // Apply filters from cached data
  const data = useMemo(() => {
    if (!allApps) {
      return []
    }

    if (onlyWithTriggers) {
      return allApps.filter((app) => app.triggers?.length)
    }

    if (onlyWithActions) {
      return allApps.filter((app) => app.actions?.length)
    }

    return allApps
  }, [allApps, onlyWithTriggers, onlyWithActions])

  return { data, loading, error }
}

export default useApps
