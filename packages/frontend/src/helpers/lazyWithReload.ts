import { type ComponentType, lazy } from 'react'

const CHUNK_RELOAD_KEY = 'chunk-reload'

/**
 * Reloads the page once when a dynamic import fails, e.g. when a deployment
 * removed the chunks that an open tab still references.
 *
 * IMPORTANT: Do not cancel `vite:preloadError` instead. Vite then resolves the
 * import to `undefined` and React.lazy throws on reading `default`.
 */
export async function importWithReload<T>(
  factory: () => Promise<T>,
): Promise<T> {
  try {
    return await factory()
  } catch (error) {
    // Rethrow on a repeat failure so that a missing chunk cannot loop reloads.
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY)
      throw error
    }
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
    window.location.reload()
    // Keep Suspense pending until the reload replaces the page.
    return new Promise<never>(() => undefined)
  }
}

export function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(() => importWithReload(factory))
}
