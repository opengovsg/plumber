import { IGlobalVariable, ITransferDetails } from '@plumber/types'

import { getM365TenantInfo } from '@/config/app-env-vars/m365'
import { getEmptyConnectionDetails } from '@/helpers/get-basic-transfer-details'

import { AuthData } from './auth-data'

async function getTransferDetails(
  $: IGlobalVariable,
): Promise<ITransferDetails> {
  const authData = $.auth?.data as AuthData
  if (!authData) {
    return getEmptyConnectionDetails($.step.position, $.app.name)
  }

  if (!authData.tenantKey) {
    return {
      position: $.step.position,
      appName: $.app.name,
      instructions: 'Invalid connection: Missing tenant',
    }
  }

  if (!authData.folderId) {
    return {
      position: $.step.position,
      appName: $.app.name,
      instructions: 'Invalid connection: Missing folder',
    }
  }

  // TODO (mal/WL): check if there is a better approach and if the table needs to be shown too
  const fileId = $.step.parameters.fileId as string
  if (!fileId) {
    return {
      position: $.step.position,
      appName: $.app.name,
      instructions: 'No M365 file is selected',
    }
  }

  // query takes around 0.5s, is this worth?
  const tenant = getM365TenantInfo(authData.tenantKey)
  const results = await $.http.get<{ name: string }>(
    `/v1.0/sites/${tenant.sharePointSiteId}/drive/items/${fileId}?$select=name`,
  )

  if (!results.data.name) {
    return {
      position: $.step.position,
      appName: $.app.name,
      instructions: 'No M365 file is found',
    }
  }

  return {
    position: $.step.position,
    appName: $.app.name,
    connectionName: results.data.name,
  }
}

export default getTransferDetails
