import appConfig from '@/config/app'

import { getEnvProxyAgent } from '../../env-proxy-agent'
import type { DevRequestRule } from '../../types'

import { PAIR_ROME_PROJECT_HEADER } from './prod-constants'

function isPairRomeUrl(url: URL): boolean {
  const { baseUrl } = appConfig.pair.rome
  // URL.canParse because a throw here would fail the caller's request.
  return URL.canParse(baseUrl) && url.hostname === new URL(baseUrl).hostname
}

// Langfuse SDKs only accept extra headers, not extra query params.
export const nonoPairRomeCompatRule: DevRequestRule = {
  // Only the nono sandbox sets NONO_PROXY_TOKEN, so outside it requests go out unchanged.
  isApplicableRequest: ({ url, headers }) =>
    Boolean(process.env.NONO_PROXY_TOKEN) &&
    headers.has(PAIR_ROME_PROJECT_HEADER) &&
    isPairRomeUrl(url),
  rewrite: (request) => {
    request.url.searchParams.set(
      'project_name',
      request.headers.get(PAIR_ROME_PROJECT_HEADER) ?? '',
    )
    request.headers.delete(PAIR_ROME_PROJECT_HEADER)
    // The Langfuse OTLP exporter passes its own agent, which ignores proxy env vars.
    request.agent = getEnvProxyAgent(request.url.protocol)
  },
}
