import App from '@/models/app'

import type { Connection, Resolvers } from '../__generated__/types.generated'

type ConnectionResolver = NonNullable<Resolvers['Connection']>

// Parent is always a Connection model row, so key is never null in practice.
function requireKey(connection: Connection): string {
  if (!connection.key) {
    throw new Error('Connection is missing key')
  }
  return connection.key
}

function storedScreenName(connection: Connection): string {
  const screenName = connection.formattedData?.screenName
  return typeof screenName === 'string' ? screenName : ''
}

const editableLabel: ConnectionResolver['editableLabel'] = async (parent) => {
  const app = await App.findOneByKey(requireKey(parent))
  if (
    app.auth?.connectionType === 'user-added' &&
    app.auth.getEditableConnectionLabel
  ) {
    return app.auth.getEditableConnectionLabel(
      parent.formattedData ?? undefined,
    )
  }

  return storedScreenName(parent)
}

const environment: ConnectionResolver['environment'] = async (parent) => {
  const app = await App.findOneByKey(requireKey(parent))
  return (
    app.auth?.getConnectionEnvironment?.(parent.formattedData ?? undefined) ??
    null
  )
}

export default {
  editableLabel,
  environment,
}
