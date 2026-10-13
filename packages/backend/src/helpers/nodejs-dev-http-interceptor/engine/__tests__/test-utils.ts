import http from 'http'
import type { AddressInfo } from 'net'

import type { DevRequestRule } from '../../types'

export interface ReceivedRequest {
  url: string
  headers: http.IncomingHttpHeaders
}

export function createRecordingServer(): {
  server: http.Server
  received: ReceivedRequest[]
  listen: () => Promise<string>
  close: () => Promise<void>
} {
  const received: ReceivedRequest[] = []
  const server = http.createServer((req, res) => {
    received.push({ url: req.url ?? '', headers: req.headers })
    res.end('ok')
  })
  return {
    server,
    received,
    listen: () =>
      new Promise((resolve) =>
        server.listen(0, '127.0.0.1', () =>
          resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`),
        ),
      ),
    close: () => new Promise((resolve) => server.close(() => resolve())),
  }
}

export function sendWithHttp(
  args: [string | URL, http.RequestOptions] | [http.RequestOptions],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = (http.request as (...a: unknown[]) => http.ClientRequest)(
      ...args,
      (res: http.IncomingMessage) => {
        res.resume()
        res.on('end', resolve)
      },
    )
    req.on('error', reject)
    req.end()
  })
}

/** Moves the marker header's value into a `marker` query param. */
export function createMarkerRule(
  markerHeader: string,
  extraRewrite: DevRequestRule['rewrite'] = () => undefined,
): DevRequestRule {
  return {
    isApplicableRequest: ({ headers }) => headers.has(markerHeader),
    rewrite: (request) => {
      request.url.searchParams.append(
        'marker',
        request.headers.get(markerHeader) ?? '',
      )
      request.headers.delete(markerHeader)
      extraRewrite(request)
    },
  }
}
