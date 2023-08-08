import { IGlobalVariable } from '@plumber/types'

const updateTableRow = async (
  $: IGlobalVariable,
  vaultId: string,
  update: { [key: string]: string }, // column name: value
): Promise<{
  [key: string]: any & {
    _metadata: {
      success: boolean
      rowsUpdated: number
    }
  }
}> => {
  const res = await $.http.put('/api/tables/row', { id: vaultId, update })
  return {
    _metadata: {
      success: true,
      rowsUpdated: 1,
    },
    ...res.data,
  }
}

export default updateTableRow
