import type { MutationResolvers } from '../__generated__/types.generated'

const createFlow: MutationResolvers['createFlow'] = async (
  _parent,
  params,
  context,
) => {
  const trimmedFlowName = params.input.flowName.trim()
  if (trimmedFlowName === '') {
    throw new Error('Pipe name needs to have at least 1 character.')
  }

  const flow = await context.currentUser.$relatedQuery('flows').insert({
    name: trimmedFlowName,
  })

  /**
   * We do not need to create an empty action since the AddStepButton already looks like an empty step
   */
  await flow.$relatedQuery('steps').insert([
    {
      type: 'trigger',
      position: 1,
    },
  ])

  return flow
}

export default createFlow
