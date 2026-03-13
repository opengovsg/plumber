import { AsyncLocalStorage } from 'async_hooks'
import { randomUUID } from 'crypto'

import logger from '@/helpers/logger'

interface QueryLog {
  sql: string
  durationMs: number
}

interface RequestContext {
  requestId: string
  operationName: string
  queryCount: number
  queries: QueryLog[]
  startTime: number
  queryStartTimes: Map<string, number>
}

export const requestContext = new AsyncLocalStorage<RequestContext>()

export function createRequestContext(
  operationName = 'unknown',
): RequestContext {
  return {
    requestId: randomUUID().substring(0, 8),
    operationName,
    queryCount: 0,
    queries: [],
    startTime: Date.now(),
    queryStartTimes: new Map(),
  }
}

export function getRequestId(): string {
  return requestContext.getStore()?.requestId || 'no-req'
}

export function markQueryStart(queryId: string): void {
  const store = requestContext.getStore()
  if (store) {
    store.queryStartTimes.set(queryId, Date.now())
  }
}

export function trackQuery(queryId: string, sql: string): void {
  const store = requestContext.getStore()
  if (store) {
    store.queryCount++
    const startTime = store.queryStartTimes.get(queryId)
    const duration = startTime ? Date.now() - startTime : 0
    store.queryStartTimes.delete(queryId)

    store.queries.push({ sql: sql.substring(0, 200), durationMs: duration })

    logger.debug(
      `[SQL][${store.operationName}][#${
        store.queryCount
      }][${duration}ms] ${sql.substring(0, 100)}`,
    )
  }
}

export function getRequestStats(): {
  queryCount: number
  totalQueryMs: number
} {
  const store = requestContext.getStore()
  if (store) {
    const totalQueryMs = store.queries.reduce((sum, q) => sum + q.durationMs, 0)
    return {
      queryCount: store.queryCount,
      totalQueryMs,
    }
  }
  return { queryCount: 0, totalQueryMs: 0 }
}
