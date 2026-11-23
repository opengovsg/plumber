import type { IConnection } from '@plumber/types'

import { DATABRICKS_APP_KEY } from '../constants'
import { databricksGeneration } from './databricks-reconnect-connections'

export type ConnectionDropdownOption = {
  label: string
  value: string
  description?: string
  env?: string // only used for FormSG / Databricks for now
}

// For FormSG, it will generate a label with the form title and the description with the form id
// Note: doing this on the frontend instead because of backwards compatibility whereby
// only re-verifying the connection on the backend will update the connection formattedData (inconsistency)
export const optionGenerator = (
  connection: Partial<IConnection>,
  appKey: string,
): ConnectionDropdownOption => {
  const screenName = connection?.formattedData?.screenName as string
  const description = connection?.description as string
  if (appKey === 'formsg') {
    // old form connections will have env as undefined and be treated as prod
    const env = (connection?.formattedData?.env as string) ?? 'prod'

    // parse the screenName to get the env, formId, and formTitle
    const [envWithFormId, formTitle] = screenName.split(' - ')
    let formId = envWithFormId
    // only if the env is not prod, we need to parse the env from the screenName
    if (env !== 'prod') {
      const endIndex = envWithFormId.indexOf(']')
      formId = envWithFormId.substring(endIndex + 2) // skip "]"
    }

    return {
      label: `${env === 'prod' ? '' : `[${env.toUpperCase()}] `}${formTitle}`,
      value: connection?.id as string,
      description: description ? `${formId} - ${description}` : formId,
      env,
    }
  }

  const name = screenName ?? 'Unnamed'
  const label =
    appKey === DATABRICKS_APP_KEY && databricksGeneration(connection) !== 'new'
      ? `[DEPRECATED] ${name}`
      : name

  return {
    label,
    value: connection?.id as string,
    description: connection?.description ?? undefined,
    env: connection?.formattedData?.env as string | undefined,
  }
}
