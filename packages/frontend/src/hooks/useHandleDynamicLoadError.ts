import { useEffect } from 'react'

const CHUNK_RELOAD_KEY = 'chunk-reload'

export function useHandleDynamicLoadError() {
  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      // Use sessionStorage to track whether we've already attempted a reload.
      // Without this guard, a persistent chunk error would cause an infinite
      // reload loop. On the first error we reload to fetch fresh assets; if
      // the error still occurs after the reload, we clear the flag and bail
      // so the user isn't stuck in a loop.
      if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
        window.location.reload()
      } else {
        sessionStorage.removeItem(CHUNK_RELOAD_KEY)
      }
    }

    window.addEventListener('vite:preloadError', handler)
    return () => window.removeEventListener('vite:preloadError', handler)
  }, [])
}
