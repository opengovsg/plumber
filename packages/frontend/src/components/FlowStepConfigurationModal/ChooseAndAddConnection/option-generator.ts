import type { IConnection } from '@plumber/types'

import { DATABRICKS_APP_KEY } from '../constants'

export type ConnectionDropdownOption = {
  label: string
  value: string
  description?: string
  env?: string // only used for FormSG / Databricks for now
}

// FormSG formattedData only updates when the owner re-verifies, so the title parse stays on the client.
export const optionGenerator = (
  connection: Partial<IConnection>,
  appKey: string,
): ConnectionDropdownOption => {
  const screenName = connection?.formattedData?.screenName as string
  const description = connection?.description as string
  if (appKey === 'formsg') {
    // old form connections will have env as undefined and be treated as prod
    const env = (connection?.formattedData?.env as string) ?? 'prod'

    const [envWithFormId, formTitle] = screenName.split(' - ')
    let formId = envWithFormId
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
  // Rows saved before generation existed omit the field.
  const label =
    appKey === DATABRICKS_APP_KEY &&
    (connection?.generation == null || connection.generation === 'legacy')
      ? `[DEPRECATED] ${name}`
      : name

  return {
    label,
    value: connection?.id as string,
    description: connection?.description ?? undefined,
    env: connection?.formattedData?.env as string | undefined,
  }
}
