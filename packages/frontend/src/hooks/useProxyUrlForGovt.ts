/**
 * Use this hook to check if user is proxied via Menlo Security, if so, prepend the proxy url
 * When proxied, the window.name property is set to "JSON:{\"safe_rid\":\"4vnqcfBf\",\"mpa_id\":\"\",\"cid\":\"******\",
 * \"cluster_id\":\"od_menlo_2b\",\"tab_id\":1,\"protocol_domain\":\"xhr-asia-southeast1-menlo-view.menlosecurity.com\",
 * \"cluster_domain\":\"asia-southeast1-menlo-view.menlosecurity.com\",\"inspect_domain\":\"asia-southeast1-menlo-view.menlosecurity.com\"}"
 * We check for existence of "menlo-view.menlosecurity.com" in window.name to determine if we should prepend the proxy url
 */

import { useCallback } from 'react'

const useProxyUrlForGovt = () => {
  const isGovtBrowser = window.name?.includes('menlo-view.menlosecurity.com')

  const createProxiedUrl = useCallback(
    (url: string) => {
      if (isGovtBrowser) {
        return `https://safe.menlosecurity.com/${url}`
      }
      return url
    },
    [isGovtBrowser],
  )

  return { createProxiedUrl }
}

export default useProxyUrlForGovt
