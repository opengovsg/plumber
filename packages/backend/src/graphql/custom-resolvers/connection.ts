import { parseDatabricksGeneration } from '@/apps/databricks/common/connection-generation'
import { APP_KEY } from '@/apps/databricks/common/constants'
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

function storedGeneration(formattedData: unknown): string {
  if (!formattedData || typeof formattedData !== 'object') {
    return parseDatabricksGeneration(undefined)
  }
  if (!('generation' in formattedData)) {
    return parseDatabricksGeneration(undefined)
  }
  return parseDatabricksGeneration(formattedData.generation)
}

const generation: ConnectionResolver['generation'] = (parent) => {
  if (parent.key !== APP_KEY) {
    return null
  }
  return storedGeneration(parent.formattedData)
}

export default {
  editableLabel,
  environment,
  generation,
}
