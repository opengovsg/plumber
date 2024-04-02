import { IGlobalVariable, ITransferDetails } from '@plumber/types'

/**
 * Note that this is for every app connection that just needs to show the connection name
 * without any further instructions (phase 1)
 * No connection is selected will show up when the app is selected but the user either
 * 1. Has not added a connection
 * 2. Managed to remove the connection (most likely through 1 successful pipe transfer)
 */

export function getEmptyConnectionDetails(
  position: number,
  appName: string,
): ITransferDetails {
  return {
    position,
    appName,
    instructions: 'No connection is selected',
  }
}

async function getTransferDetails(
  $: IGlobalVariable,
): Promise<ITransferDetails | null> {
  const screenName = $.auth.data?.screenName as string
  if (!screenName) {
    return getEmptyConnectionDetails($.step.position, $.app.name)
  }

  return {
    position: $.step.position,
    appName: $.app.name,
    connectionName: screenName,
  }
}

export default getTransferDetails
