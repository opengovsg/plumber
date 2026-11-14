import { IGlobalVariable } from '@plumber/types'
import { z } from 'zod'

import StepError from '@/errors/step'

import { throwSlackApiError } from '../../common/throw-slack-api-error'

const missingScopeSchema = z.object({
  error: z.literal('missing_scope'),
  needed: z.string(),
})

/**
 * New Slack connections no longer get `search:read`, because Find a message is deprecated.
 */
function isMissingSearchScope(data: unknown): boolean {
  const parsed = missingScopeSchema.safeParse(data)
  return parsed.success && parsed.data.needed.split(',').includes('search:read')
}

type FindMessageOptions = {
  query: string
  sortBy: string
  sortDirection: string
  count: number
}

const findMessage = async ($: IGlobalVariable, options: FindMessageOptions) => {
  const params = {
    query: options.query,
    sort: options.sortBy,
    sort_dir: options.sortDirection,
    count: options.count || 1,
  }

  const response = await $.http.get('/search.messages', {
    params,
  })

  const data = response.data

  if (!data.ok && data) {
    if (isMissingSearchScope(data)) {
      throw new StepError({
        name: 'Slack connection cannot search messages',
        solution:
          'Find a message has been deprecated. Slack connections created after the deprecation cannot search messages. Select an older Slack connection, or remove this step.',
        kind: 'config',
      })
    }
    throwSlackApiError(data)
  }

  $.setActionItem({ raw: data?.messages.matches[0] })
}

export default findMessage
