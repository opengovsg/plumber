import { ForbiddenError } from '@/errors/graphql-errors'
import { getConnection } from '@/services/connection'

import type { MutationResolvers } from '../__generated__/types.generated'

// Sensitive graphql variables redacted in morgan.ts and datadog's Sensitive Data
// Scanner

const updateConnection: MutationResolvers['updateConnection'] = async (
  _parent,
  params,
  context,
) => {
  const flow = await context.currentUser
    .withAccessibleFlows({ requiredRole: 'editor' })
    .findById(params.input.flowId)
    .throwIfNotFound({ message: 'You do not have access to this flow' })

  let connection = await getConnection({
    context,
    connectionId: params.input.id,
    flowId: params.input.flowId,
    includeOwnConnections: flow.role === 'owner',
  })

  // GUARD: Prevent updating personal connections owned by others
  if (
    connection.userId !== null &&
    connection.userId !== context.currentUser.id
  ) {
    throw new ForbiddenError(
      'You cannot update a personal connection that you do not own',
    )
  }

  connection = await connection.$query().patchAndFetch({
    formattedData: {
      ...connection.formattedData,
      ...params.input.formattedData,
    },
  })

  return connection
}

export default updateConnection
