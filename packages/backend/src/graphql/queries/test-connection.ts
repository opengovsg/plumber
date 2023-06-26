import globalVariable from '@/helpers/global-variable'
import App from '@/models/app'
import Context from '@/types/express/context'

type Params = {
  id: string
  data: object
}

const testConnection = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  let connection = await context.currentUser
    .$relatedQuery('connections')
    .findOne({
      id: params.id,
    })
    .throwIfNotFound()

  const app = await App.findOneByKey(connection.key, false)
  const $ = await globalVariable({ connection, app })

  let isStillVerified
  try {
    isStillVerified = !!(await app.auth.isStillVerified($))
  } catch {
    isStillVerified = false
  }

  connection = await connection.$query().patchAndFetch({
    formattedData: connection.formattedData,
    verified: isStillVerified,
  })

  return connection
}

export default testConnection
