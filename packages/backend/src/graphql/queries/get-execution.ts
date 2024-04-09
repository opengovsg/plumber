import type { QueryResolvers } from '../__generated__/types.generated'

const getExecution: QueryResolvers['getExecution'] = async (
  _parent,
  params,
  context,
) => {
  const execution = await context.currentUser
    .$relatedQuery('executions')
    .withGraphFetched({
      flow: {
        steps: true,
      },
    })
    .findById(params.executionId)
    .throwIfNotFound()

  return execution
}

export default getExecution
