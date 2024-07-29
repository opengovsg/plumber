import type { MutationResolvers } from '../__generated__/types.generated'

const createFlow: MutationResolvers['createFlow'] = async (
  _parent,
  params,
  context,
) => {
  const flow = await context.currentUser.$relatedQuery('flows').insert({
    name: params.input.flowName,
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
