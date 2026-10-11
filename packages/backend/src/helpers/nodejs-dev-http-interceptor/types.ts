import type http from 'http'

export interface DevRequest {
  url: URL
  /** A copy of the caller's headers, so rules can edit it freely. */
  headers: Headers
  /** Applies to `http.request` and `https.request` only. `fetch` ignores it. */
  agent: http.RequestOptions['agent']
}

export type ApplicableRequestParams = Readonly<
  Pick<DevRequest, 'url' | 'headers'>
>

export interface DevRequestRule {
  /**
   * IMPORTANT: Match only on something the calling code adds on purpose (e.g. a marker header).
   * The engine sees every request in the process, so matching on URL or host rewrites other
   * libraries' requests.
   */
  isApplicableRequest(request: ApplicableRequestParams): boolean
  rewrite(request: DevRequest): void
}
