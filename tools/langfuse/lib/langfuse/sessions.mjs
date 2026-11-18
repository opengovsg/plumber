import {
  ALL_TIME_START,
  INITIAL_WINDOW_MS,
  MIN_PAGE_SIZE,
  MIN_WINDOW_MS,
  OUTAGE_RETRY_DELAYS_MS,
  PAGE_SIZE,
  REQUEST_OPTIONS,
  TARGET_SESSIONS_PER_WINDOW,
} from '../constants.mjs'
import { fetchInOrder, sleep } from '../utils/concurrency.mjs'
import { formatDuration } from '../utils/dates.mjs'
import {
  describeError,
  fail,
  isOutage,
  isQueryTimeout,
} from '../utils/errors.mjs'
import { printStatus } from '../utils/terminal.mjs'

/**
 * Sizes the next window to hold about `targetSessions`, based on the last window's count.
 *
 * Growth and shrinkage are capped per step, so one sparse or dense window cannot swing it wildly.
 */
export function nextWindowMs({
  windowMs,
  totalItems,
  targetSessions,
  rangeMs,
}) {
  const idealMs =
    totalItems === 0 ? windowMs * 2 : (windowMs * targetSessions) / totalItems
  return Math.round(
    Math.min(
      Math.max(idealMs, windowMs / 4, MIN_WINDOW_MS),
      windowMs * 2,
      rangeMs,
    ),
  )
}

// Older Langfuse servers ignore the environment filter, so verify each session.
function filterByEnvironment(sessions, environment) {
  const result = { items: [], mismatched: 0, missing: 0 }
  for (const session of sessions) {
    if (session.environment === undefined) {
      result.missing++
    } else if (session.environment !== environment) {
      result.mismatched++
      continue
    }
    result.items.push(session)
  }
  return result
}

async function fetchWindow(client, options, { from, to, limit }) {
  const fetchPage = async (page) => {
    const response = await client.api.sessions.list(
      {
        page,
        limit,
        fromTimestamp: from.toISOString(),
        toTimestamp: to.toISOString(),
        environment: options.environment,
      },
      REQUEST_OPTIONS,
    )
    return {
      ...filterByEnvironment(response.data, options.environment),
      meta: response.meta,
    }
  }

  const first = await fetchPage(1)
  const pages = [first]
  const remainingPages = Array.from(
    { length: Math.max(first.meta.totalPages - 1, 0) },
    (_, i) => i + 2,
  )
  // Stops starting new pages once one fails, since the window will be retried anyway.
  let failed = false
  await fetchInOrder(
    remainingPages,
    options.concurrency,
    async (page) => {
      if (failed) {
        return null
      }
      try {
        return await fetchPage(page)
      } catch (error) {
        failed = true
        throw error
      }
    },
    (page) => {
      pages.push(page)
    },
  )
  return { pages, totalItems: first.meta.totalItems }
}

function warnAboutEnvironment({ mismatched, missing }) {
  if (mismatched > 0) {
    console.warn(
      `Skipped ${mismatched} sessions from other environments. The server ignored the environment filter.`,
    )
  }
  if (missing > 0) {
    console.warn(
      `WARNING: ${missing} sessions have no environment field. They may come from any environment.`,
    )
  }
}

/**
 * Lists sessions newest first, window by window, calling `onSession` in that order.
 *
 * Langfuse times out on large queries, so each window is sized from the previous window's session count.
 * Walking backward meets the dense recent sessions first, before sparse history grows the window.
 * On a fatal error, `error.listedBackTo` marks how far back listing got.
 */
export async function listSessions(client, options, onSession) {
  const seen = new Set()
  const environmentCounts = { mismatched: 0, missing: 0 }

  const rangeStart = options.range.from ?? ALL_TIME_START
  const rangeEnd = options.range.to
  const rangeMs = Math.max(rangeEnd - rangeStart, 1)

  let cursor = rangeEnd
  let windowMs = Math.min(INITIAL_WINDOW_MS, rangeMs)
  let limit = PAGE_SIZE
  let targetSessions = TARGET_SESSIONS_PER_WINDOW
  let outageRetries = 0

  while (cursor > rangeStart) {
    const windowStart = new Date(
      Math.max(cursor.getTime() - windowMs, rangeStart.getTime()),
    )
    const pct = Math.floor(((rangeEnd - cursor) / rangeMs) * 100)
    printStatus(
      `Listing sessions: back to ${cursor.toISOString()} (${pct}%) · ${seen.size} found · window ${formatDuration(windowMs)}`,
    )

    let result
    try {
      result = await fetchWindow(client, options, {
        from: windowStart,
        to: cursor,
        limit,
      })
    } catch (error) {
      if (isOutage(error) && outageRetries < OUTAGE_RETRY_DELAYS_MS.length) {
        const delayMs = OUTAGE_RETRY_DELAYS_MS[outageRetries++]
        printStatus(
          `Langfuse failed (${describeError(error)}). Waiting ${delayMs / 1000}s before retry ${outageRetries}/${OUTAGE_RETRY_DELAYS_MS.length}.`,
          { keep: true },
        )
        await sleep(delayMs)
        continue
      }
      if (!isQueryTimeout(error)) {
        error.listedBackTo = cursor
        throw error
      }
      // Each timeout costs a full server timeout, so shrink aggressively and remember the lower ceiling.
      targetSessions = Math.max(MIN_PAGE_SIZE, Math.floor(targetSessions / 2))
      if (windowMs > MIN_WINDOW_MS) {
        windowMs = Math.max(MIN_WINDOW_MS, Math.floor(windowMs / 4))
        printStatus(
          `Langfuse timed out. Retrying with a ${formatDuration(windowMs)} window.`,
          { keep: true },
        )
        continue
      }
      if (limit > MIN_PAGE_SIZE) {
        limit = Math.max(MIN_PAGE_SIZE, Math.floor(limit / 2))
        printStatus(
          `Langfuse timed out. Retrying with ${limit} sessions per page.`,
          { keep: true },
        )
        continue
      }
      throw Object.assign(
        new Error(
          `Langfuse timed out on a ${formatDuration(windowMs)} window ending ${cursor.toISOString()} with ${limit} sessions per page.`,
        ),
        { listedBackTo: cursor },
      )
    }

    // The sessions endpoint has no sort option, so order each window here.
    const windowSessions = []
    for (const page of result.pages) {
      environmentCounts.mismatched += page.mismatched
      environmentCounts.missing += page.missing
      windowSessions.push(...page.items)
    }
    windowSessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    for (const session of windowSessions) {
      // Adjacent windows can share a boundary session.
      if (!seen.has(session.id)) {
        seen.add(session.id)
        await onSession(session)
      }
    }

    cursor = windowStart
    outageRetries = 0
    windowMs = nextWindowMs({
      windowMs,
      totalItems: result.totalItems,
      targetSessions,
      rangeMs,
    })
  }
  printStatus(`Listing sessions: done (100%) · ${seen.size} found`, {
    keep: true,
  })
  warnAboutEnvironment(environmentCounts)

  return seen.size
}

export async function getSession(client, { sessionId, environment }) {
  const session = await client.api.sessions
    .get(sessionId, REQUEST_OPTIONS)
    .catch((error) => {
      fail(`Could not load session ${sessionId}: ${describeError(error)}`)
    })
  if (
    session.environment !== undefined &&
    session.environment !== environment
  ) {
    fail(
      `Session ${sessionId} is in "${session.environment}", not "${environment}". Pass --environment=${session.environment}.`,
    )
  }
  return { id: session.id, createdAt: session.createdAt }
}
