import { z } from 'zod'

import Template from '@/models/template'

import type { QueryResolvers } from '../__generated__/types.generated'

const getTemplate: QueryResolvers['getTemplate'] = async (_parent, params) => {
  // To avoid the gibberish error code if a user keys in an invalid template route e.g. template/123
  if (!z.string().uuid().safeParse(params.id).success) {
    throw new Error('NotFoundError')
  }

  return await Template.query()
    .findById(params.id)
    .withGraphFetched({
      steps: true,
    })
    .throwIfNotFound()
}

export default getTemplate
