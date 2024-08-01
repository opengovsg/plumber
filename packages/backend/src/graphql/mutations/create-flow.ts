import type { MutationResolvers } from '../__generated__/types.generated'

const createFlow: MutationResolvers['createFlow'] = async (
  _parent,
  params,
  context,
) => {
  const { flowName } = params.input
  if (flowName.trim() === '') {
    throw new Error('Pipe name needs to have at least 1 character.')
  }

  const flow = await context.currentUser.$relatedQuery('flows').insert({
    name: flowName,
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
