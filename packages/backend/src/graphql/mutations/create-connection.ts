import { IJSONObject } from '@plumber/types'

import App from '@/models/app'
import Context from '@/types/express/context'

// Sensitive graphql variables redacted in morgan.ts and datadog's Sensitive Data Scanner

type Params = {
  input: {
    key: string
    formattedData: IJSONObject
  }
}
const createConnection = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  await App.findOneByKey(params.input.key)

  return await context.currentUser.$relatedQuery('connections').insert({
    key: params.input.key,
    formattedData: params.input.formattedData,
    verified: false,
  })
}

export default createConnection
