import App from '@/models/app'

import type { Connection, Resolvers } from '../__generated__/types.generated'

type ConnectionResolver = Resolvers['Connection']

function storedScreenName(connection: Connection): string {
  const screenName = connection.formattedData?.screenName
  return typeof screenName === 'string' ? screenName : ''
}

const editableLabel: ConnectionResolver['editableLabel'] = async (parent) => {
  const app = await App.findOneByKey(parent.key)
  if (
    app.auth?.connectionType === 'user-added' &&
    app.auth.getEditableConnectionLabel
  ) {
    return app.auth.getEditableConnectionLabel(parent.formattedData)
  }

  return storedScreenName(parent)
}

const environment: ConnectionResolver['environment'] = async (parent) => {
  const app = await App.findOneByKey(parent.key)
  return app.auth?.getConnectionEnvironment?.(parent.formattedData) ?? null
}

export default {
  editableLabel,
  environment,
}
