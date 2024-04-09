import type { MutationResolvers } from '../__generated__/types.generated'

const updateFlow: MutationResolvers['updateFlow'] = async (
  _parent,
  params,
  context,
) => {
  const flow = await context.currentUser
    .$relatedQuery('flows')
    .findOne({
      id: params.input.id,
    })
    .throwIfNotFound()

  return await flow.$query().patchAndFetch({
    name: params.input.name,
  })
}

export default updateFlow
