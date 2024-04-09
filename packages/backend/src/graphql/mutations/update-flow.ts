import type { MutationResolvers } from '../__generated__/types.generated'

const updateFlow: MutationResolvers['updateFlow'] = async (
  _parent,
  params,
  context,
) => {
  let flow = await context.currentUser
    .$relatedQuery('flows')
    .findOne({
      id: params.input.id,
    })
    .throwIfNotFound()

  flow = await flow.$query().patchAndFetch({
    name: params.input.name,
  })

  return flow
}

export default updateFlow
