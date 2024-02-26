import type { MutationResolvers } from '../__generated__/types.generated'

// Sensitive graphql variables redacted in morgan.ts and datadog's Sensitive Data
// Scanner

const updateConnection: NonNullable<
  MutationResolvers['updateConnection']
> = async (_parent, params, context) => {
  let connection = await context.currentUser
    .$relatedQuery('connections')
    .findOne({
      id: params.input.id,
    })
    .throwIfNotFound()

  connection = await connection.$query().patchAndFetch({
    formattedData: {
      ...connection.formattedData,
      ...params.input.formattedData,
    },
  })

  return connection
}

export default updateConnection
