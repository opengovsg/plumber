import type { MutationResolvers } from '../__generated__/types.generated'

const updateFlow: MutationResolvers['updateFlow'] = async (
  _parent,
  params,
  context,
) => {
  const flow = await context.currentUser
    .withAccessibleFlows({ requiredRole: 'editor' })
    .findOne({
      id: params.input.id,
    })
    .throwIfNotFound()

  flow.assertNotUpdatedSince(params.input.updatedAt, context.currentUser.id)

  return await flow.$query().patchAndFetch({
    name: params.input.name,
    updatedAt: new Date().toISOString(),
    updatedBy: context.currentUser.id,
  })
}

export default updateFlow
