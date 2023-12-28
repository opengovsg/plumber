/**
 * TODO: remove this file and reuse test connection endpoint
 */

import globalVariable from '@/helpers/global-variable'
import App from '@/models/app'
import Context from '@/types/express/context'

type Params = {
  input: {
    id: string
  }
}

const verifyConnection = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  let connection = await context.currentUser
    .$relatedQuery('connections')
    .findOne({
      id: params.input.id,
    })
    .throwIfNotFound()

  const app = await App.findOneByKey(connection.key)
  const $ = await globalVariable({ connection, app, user: context.currentUser })

  await app.auth.verifyCredentials($)

  connection = await connection.$query().patchAndFetch({
    verified: true,
    draft: false,
  })

  return {
    ...connection,
    app,
  }
}

export default verifyConnection
