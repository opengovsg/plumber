import { useCallback, useState } from 'react'

function getViewTokenStorageKey(tableId: string): string {
  return `tile-view-token:${tableId}`
}

export function useViewToken(tableId: string) {
  const [viewToken, setViewToken] = useState<string | null>(() =>
    sessionStorage.getItem(getViewTokenStorageKey(tableId)),
  )

  const storeViewToken = useCallback(
    (token: string) => {
      sessionStorage.setItem(getViewTokenStorageKey(tableId), token)
      setViewToken(token)
    },
    [tableId],
  )

  return { viewToken, storeViewToken }
}
