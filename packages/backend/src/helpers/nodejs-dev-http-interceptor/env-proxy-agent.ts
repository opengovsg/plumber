import http from 'http'
import https from 'https'

// Mirrors the keys Node's own `filterEnvForProxies` reads.
const PROXY_ENV_KEYS = [
  'http_proxy',
  'HTTP_PROXY',
  'https_proxy',
  'HTTPS_PROXY',
  'no_proxy',
  'NO_PROXY',
] as const
type ProxyEnv = Partial<Record<(typeof PROXY_ENV_KEYS)[number], string>>

// `@types/node` 22 predates `proxyEnv`, which Node 22.21 supports.
type ProxyAgentOptions = http.AgentOptions & { proxyEnv: ProxyEnv }

// One agent per protocol so `keepAlive` can reuse sockets across requests.
const agents = new Map<string, http.Agent>()

function getProxyEnv(): ProxyEnv {
  return Object.fromEntries(
    PROXY_ENV_KEYS.map((key) => [key, process.env[key]]),
  )
}

/**
 * Returns a shared agent that follows HTTP(S)_PROXY and NO_PROXY.
 *
 * Callers' own agents ignore proxy env vars, even with NODE_USE_ENV_PROXY.
 */
export function getEnvProxyAgent(protocol: string): http.Agent {
  const existing = agents.get(protocol)
  if (existing) {
    return existing
  }
  const options: ProxyAgentOptions = {
    keepAlive: true,
    proxyEnv: getProxyEnv(),
  }
  const agent =
    protocol === 'https:' ? new https.Agent(options) : new http.Agent(options)
  agents.set(protocol, agent)
  return agent
}
