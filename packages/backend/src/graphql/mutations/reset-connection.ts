import { BadUserInputError } from '@/errors/graphql-errors'

import type { MutationResolvers } from '../__generated__/types.generated'

const resetConnection: MutationResolvers['resetConnection'] = async (
  _parent,
  params,
  context,
) => {
  const { input } = params
  if (!input) {
    throw new BadUserInputError('Missing input')
  }

  let connection = await context.currentUser
    .$relatedQuery('connections')
    .findOne({
      id: input.id,
    })
    .throwIfNotFound()

  if (!connection.formattedData) {
    return null
  }

  connection = await connection.$query().patchAndFetch({
    formattedData: { screenName: connection.formattedData.screenName },
  })

  return connection
}

export default resetConnection
