import { DynamicData, IGlobalVariable } from '@plumber/types'

import { VAULT_ID } from '../../common/constants'
import { getColumnMappingInAlias } from '../../common/get-column-mapping'

const PREDEFINED_VAULT_COLUMN = {
  name: 'Vault Row ID',
  value: VAULT_ID,
}

export async function getColumns(
  $: IGlobalVariable,
  updatableOnly = false,
): Promise<DynamicData> {
  const mapping = await getColumnMappingInAlias($)
  const response: DynamicData = {
    data: [],
  }

  if (!updatableOnly) {
    // NOTE: vault workspace has pre-defined column called vault_id
    response.data.push(PREDEFINED_VAULT_COLUMN)
  }

  for (const key in mapping) {
    response.data.push({
      name: key,
      value: mapping[key],
    })
  }
  return response
}
