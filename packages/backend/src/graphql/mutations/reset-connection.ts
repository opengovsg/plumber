import type { MutationResolvers } from '../__generated__/types.generated'

const resetConnection: NonNullable<
  MutationResolvers['resetConnection']
> = async (_parent, params, context) => {
  let connection = await context.currentUser
    .$relatedQuery('connections')
    .findOne({
      id: params.input.id,
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
