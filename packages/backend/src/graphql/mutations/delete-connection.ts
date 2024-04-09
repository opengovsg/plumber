import type { MutationResolvers } from '../__generated__/types.generated'

const deleteConnection: MutationResolvers['deleteConnection'] = async (
  _parent,
  params,
  context,
) => {
  await context.currentUser
    .$relatedQuery('connections')
    .delete()
    .findOne({
      id: params.input.id,
    })
    .throwIfNotFound()

  return true
}

export default deleteConnection
