import { IGlobalVariable } from '@plumber/types'

const updateTableRow = async (
  $: IGlobalVariable,
  vaultId: string,
  update: { [key: string]: string }, // column name: value
): Promise<void> => {
  const res = await $.http.put('/api/tables/row', { id: vaultId, update })
  $.setActionItem({
    raw: {
      success: true,
      ...res.data,
    },
  })
}

export default updateTableRow
