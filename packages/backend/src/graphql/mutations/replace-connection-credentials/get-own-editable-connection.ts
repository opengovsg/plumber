import type { IApp, IUserAddedConnectionAuth } from '@plumber/types'

import { ForbiddenError } from '@/errors/graphql-errors'
import App from '@/models/app'
import Connection from '@/models/connection'
import Context from '@/types/express/context'

type EditableConnectionApp = IApp & {
  auth: IUserAddedConnectionAuth
}

function isEditableConnectionApp(app: IApp): app is EditableConnectionApp {
  return (
    app.auth?.connectionType === 'user-added' &&
    Boolean(app.auth.supportsConnectionEdit)
  )
}

/**
 * Owner's connection only, and only for apps that opted into credentials
 * editing from the connections page.
 */
export default async function getOwnEditableConnection({
  context,
  connectionId,
}: {
  context: Context
  connectionId: string
}): Promise<{ connection: Connection; app: EditableConnectionApp }> {
  const connection = await context.currentUser
    .$relatedQuery('connections')
    .findById(connectionId)
    .throwIfNotFound({ message: 'Connection not found' })

  const app = await App.findOneByKey(connection.key)

  if (!isEditableConnectionApp(app)) {
    throw new ForbiddenError('This connection cannot be edited')
  }

  return {
    connection,
    app,
  }
}
