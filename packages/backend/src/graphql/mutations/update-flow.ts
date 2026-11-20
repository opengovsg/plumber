import { BadUserInputError } from '@/errors/graphql-errors'

import type { MutationResolvers } from '../__generated__/types.generated'

const updateFlow: MutationResolvers['updateFlow'] = async (
  _parent,
  params,
  context,
) => {
  const { input } = params
  if (!input) {
    throw new BadUserInputError('Missing input')
  }

  const flow = await context.currentUser
    .withAccessibleFlows({ requiredRole: 'editor' })
    .findOne({
      id: input.id,
    })
    .throwIfNotFound()

  flow.assertNotUpdatedSince(input.updatedAt, context.currentUser.id)

  return await flow.$query().patchAndFetch({
    name: input.name,
    updatedAt: new Date().toISOString(),
    updatedBy: context.currentUser.id,
  })
}

export default updateFlow
