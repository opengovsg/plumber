import { REQUEST_OPTIONS } from '../constants.mjs'
import { fetchInOrder } from '../utils/concurrency.mjs'
import { describeError } from '../utils/errors.mjs'
import { createProgress } from '../utils/terminal.mjs'

// Tells Langfuse which field groups to compute for the last-trace lookup.
export function buildListFields(include, needsFullTrace) {
  if (needsFullTrace) {
    return 'core'
  }
  return [
    'core',
    'io',
    ...(include.includes('metrics') ? ['metrics'] : []),
    ...(include.includes('counts') ? ['observations', 'scores'] : []),
  ].join(',')
}

async function fetchLastTrace(client, session, options, listFields) {
  const response = await client.api.trace.list(
    {
      page: 1,
      limit: 1,
      orderBy: 'timestamp.desc',
      sessionId: session.id,
      environment: options.environment,
      fields: listFields,
    },
    REQUEST_OPTIONS,
  )
  const [last] = response.data
  if (!last) {
    return null
  }
  const trace = options.needsFullTrace
    ? await client.api.trace.get(last.id, REQUEST_OPTIONS)
    : last
  return { session, trace, traceCount: response.meta.totalItems }
}

/**
 * Fetches each session's last trace, which holds the input and output of the whole conversation.
 *
 * Calls `onRecord` in session order. Sessions whose last trace is from another environment are counted in `skipped`.
 */
export async function fetchLastTraces(client, sessions, options, onRecord) {
  const listFields = buildListFields(options.include, options.needsFullTrace)
  const progress = createProgress('Downloading last traces')
  const failures = []
  let skipped = 0
  let done = 0

  progress.update(0, sessions.length)
  await fetchInOrder(
    sessions,
    options.concurrency,
    async (session) => {
      try {
        return await fetchLastTrace(client, session, options, listFields)
      } catch (error) {
        failures.push({ id: session.id, message: describeError(error) })
        return null
      } finally {
        progress.update(++done, sessions.length)
      }
    },
    async (result) => {
      if (!result) {
        return
      }
      if (options.userId && result.trace.userId !== options.userId) {
        return
      }
      if (
        result.trace.environment !== undefined &&
        result.trace.environment !== options.environment
      ) {
        skipped++
        return
      }
      await onRecord(result)
    },
  )
  progress.finish()
  return { failures, skipped }
}
