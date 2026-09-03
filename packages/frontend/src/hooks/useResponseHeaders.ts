import { useEffect, useState } from 'react'

import { RESPONSE_HEADERS, type ResponseHeader } from '@/config/headers'
import { GRAPHQL_URL } from '@/graphql/client'

export const useResponseHeaders = () => {
  const [headers, setHeaders] = useState<Record<ResponseHeader, string>>(
    {} as Record<ResponseHeader, string>,
  )

  useEffect(() => {
    fetch(`${GRAPHQL_URL}?query={ __typename }`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then((res) => {
      const responseHeaders: Record<string, string> = {}
      Object.values(RESPONSE_HEADERS).forEach((header) => {
        responseHeaders[header] = res.headers.get(header) ?? ''
      })
      setHeaders(responseHeaders)
    })
  }, [])

  return headers
}
