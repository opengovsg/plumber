/**
 * Patches Node's `http.request` and `https.request`.
 *
 * Clients like the OTLP exporter call these directly instead of `fetch()`.
 */
import type http from 'http'

import type { DevRequest, DevRequestRule } from '../types'

import { applyRules, hasApplicableRule } from './apply-rules'
import { logBuildFailure } from './log-build-failure'

type RequestFn = typeof http.request

interface ParsedArgs {
  url: string | URL | undefined
  options: http.RequestOptions
  rest: unknown[]
}

// Mirrors the `request(url, options?, cb?)` and `request(options, cb?)` overloads.
function parseArgs(args: unknown[]): ParsedArgs | null {
  const [first, second] = args
  if (typeof first === 'string' || first instanceof URL) {
    const hasOptions = typeof second === 'object' && second !== null
    return {
      url: first,
      options: hasOptions ? (second as http.RequestOptions) : {},
      rest: args.slice(hasOptions ? 2 : 1),
    }
  }
  if (typeof first === 'object' && first !== null) {
    return {
      url: undefined,
      options: first as http.RequestOptions,
      rest: args.slice(1),
    }
  }
  return null
}

function toHeaders(outgoing: http.RequestOptions['headers']): Headers {
  const headers = new Headers()
  if (Array.isArray(outgoing)) {
    for (let i = 0; i + 1 < outgoing.length; i += 2) {
      headers.append(outgoing[i], outgoing[i + 1])
    }
    return headers
  }
  for (const [name, value] of Object.entries(outgoing ?? {})) {
    if (value === undefined) {
      continue
    }
    for (const item of Array.isArray(value) ? value : [value]) {
      headers.append(name, String(item))
    }
  }
  return headers
}

function urlFromOptions(
  options: http.RequestOptions,
  defaultProtocol: string,
): URL {
  const origin = new URL(`${options.protocol ?? defaultProtocol}//localhost`)
  origin.hostname = options.hostname ?? options.host ?? 'localhost'
  if (options.port != null) {
    origin.port = String(options.port)
  }
  return new URL(options.path ?? '/', origin)
}

function buildRequest(
  parsed: ParsedArgs,
  defaultProtocol: string,
): DevRequest | null {
  try {
    return {
      url: parsed.url
        ? new URL(parsed.url)
        : urlFromOptions(parsed.options, defaultProtocol),
      // Copy because callers reuse one headers object across requests.
      headers: toHeaders(parsed.options.headers),
      agent: parsed.options.agent,
    }
  } catch (error) {
    logBuildFailure('http', error)
    return null
  }
}

function rewriteRequestArgs(
  args: unknown[],
  rules: readonly DevRequestRule[],
  defaultProtocol: string,
): unknown[] {
  const parsed = parseArgs(args)
  const request = parsed && buildRequest(parsed, defaultProtocol)
  if (!parsed || !request || !hasApplicableRule(rules, request)) {
    return args
  }

  applyRules(rules, request)
  const rewrittenOptions: http.RequestOptions = {
    ...parsed.options,
    headers: Object.fromEntries(request.headers),
    agent: request.agent,
  }
  if (parsed.url) {
    return [request.url, rewrittenOptions, ...parsed.rest]
  }
  return [
    {
      ...rewrittenOptions,
      hostname: request.url.hostname.replace(/^\[|\]$/g, ''),
      port: request.url.port || undefined,
      path: `${request.url.pathname}${request.url.search}`,
    },
    ...parsed.rest,
  ]
}

export function patchRequest(
  mod: { request: RequestFn },
  rules: readonly DevRequestRule[],
  defaultProtocol: string,
): void {
  const originalRequest = mod.request
  mod.request = function (this: unknown, ...args: unknown[]) {
    return originalRequest.apply(
      this,
      rewriteRequestArgs(args, rules, defaultProtocol) as Parameters<RequestFn>,
    )
  } as RequestFn
}
