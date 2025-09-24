import { IStep } from '@plumber/types'

/**
 * THIS MUST BE UPDATED WHEN A NEW APP OR NEW DYNAMIC FIELD IS ADDED
 * we only need to app apps that have fields that behave like connections.
 * apps that only have connections such as formsg or postman-sms
 * do not need to be specified here
 */
export const APP_CONNECTION_FIELDS: Record<
  IStep['appKey'],
  {
    parameterKey?: string
    dynamicDataKey?: string
  }
> = {
  'm365-excel': {
    parameterKey: 'fileId',
    dynamicDataKey: 'listFiles',
  },
  lettersg: {
    parameterKey: 'templateId',
    dynamicDataKey: 'getTemplateIds',
  },
  slack: {
    parameterKey: 'channel',
    dynamicDataKey: 'listChannels',
  },
  'telegram-bot': {
    parameterKey: 'chatId',
    dynamicDataKey: 'listChats',
  },
  tiles: {
    parameterKey: 'tableId',
    dynamicDataKey: 'listTables',
  },
}

export function getConnectionDetails(steps: IStep[]): {
  connection: {
    [connectionId: string]: {
      [appKey: string]: string[]
    }
  }
  table: string[]
} {
  const connections: {
    connection: {
      [connectionId: string]: {
        [appKey: string]: string[]
      }
    }
    table: string[]
  } = {
    connection: {},
    table: [],
  }

  steps.map((step) => {
    if (step.connectionId) {
      connections.connection[step.connectionId] ??= {}

      const paramKey = APP_CONNECTION_FIELDS[step.appKey]?.parameterKey
      const paramValue = step.parameters[paramKey] as string

      // only some apps need the metadata, so we only add it if the app has a parameter key
      if (paramKey) {
        connections.connection[step.connectionId][paramKey] ??= []

        // push only if not already present
        if (
          paramValue &&
          !connections.connection[step.connectionId][paramKey].includes(
            paramValue,
          )
        ) {
          connections.connection[step.connectionId][paramKey].push(paramValue)
        }
      }
    }

    /**
     * SPECIAL CASE: Tiles does not have a connection id
     * so we use the tableId instead.
     */
    if (step.appKey === 'tiles') {
      const paramKey = APP_CONNECTION_FIELDS[step.appKey].parameterKey
      const paramValue = step.parameters[paramKey] as string

      if (paramValue && !connections.table.includes(paramValue)) {
        connections.table.push(paramValue)
      }
    }
  })

  return connections
}
