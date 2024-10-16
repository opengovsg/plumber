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

  await flow.$relatedQuery('steps').insert([
    {
      type: 'trigger',
      position: 1,
    },
    {
      type: 'action',
      position: 2,
    },
  ])

  return flow
}

export default createFlow
