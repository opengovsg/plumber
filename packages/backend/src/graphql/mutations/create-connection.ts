import App from '@/models/app'

import type { MutationResolvers } from '../__generated__/types.generated'

// Sensitive graphql variables redacted in morgan.ts and datadog's Sensitive
// Data Scanner

const createConnection: MutationResolvers['createConnection'] = async (
  _parent,
  params,
  context,
) => {
  await App.findOneByKey(params.input.key)

  return await context.currentUser.$relatedQuery('connections').insert({
    key: params.input.key,
    formattedData: params.input.formattedData,
    verified: false,
  })
}

export default createConnection
