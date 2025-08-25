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

export const TILES_CONNECTION_ID = '00000000-0000-0000-0000-000000000000'

export function getConnectionDetails(steps: IStep[]): {
  [connectionId: string]: {
    [appKey: string]: string[]
  }
} {
  const connections: {
    [connectionId: string]: {
      [appKey: string]: string[]
    }
  } = {}

  steps.map((step) => {
    if (step.connectionId) {
      connections[step.connectionId] ??= {}

      const paramKey = APP_CONNECTION_FIELDS[step.appKey]?.parameterKey
      const paramValue = step.parameters[paramKey] as string

      // only some apps need the metadata, so we only add it if the app has a parameter key
      if (paramKey) {
        connections[step.connectionId][paramKey] ??= []

        // push only if not already present
        if (
          paramValue &&
          !connections[step.connectionId][paramKey].includes(paramValue)
        ) {
          connections[step.connectionId][paramKey].push(paramValue)
        }
      }
    }

    /**
     * SPECIAL CASE: Tiles does not have a connection id
     * but we want to restrict the dynamic data to the tile id (tableId)
     * so we use a special connection id to store the dynamic data
     */
    if (step.appKey === 'tiles') {
      const paramKey = APP_CONNECTION_FIELDS[step.appKey].parameterKey
      const paramValue = step.parameters[paramKey] as string

      // create nested objects if missing
      connections[TILES_CONNECTION_ID] ??= {}
      connections[TILES_CONNECTION_ID][paramKey] ??= []

      if (
        paramValue &&
        !connections[TILES_CONNECTION_ID][paramKey].includes(paramValue)
      ) {
        connections[TILES_CONNECTION_ID][paramKey].push(paramValue)
      }
    }
  })

  return connections
}
