import { IGlobalVariable, ITransferDetails } from '@plumber/types'

import TableMetadata from '@/models/table-metadata'

async function getTransferDetails(
  $: IGlobalVariable,
): Promise<ITransferDetails> {
  const tableId = $.step.parameters.tableId as string
  if (!tableId) {
    return {
      position: $.step.position,
      appName: $.app.name,
      instructions: 'No tile is selected',
    }
  }

  const table = await TableMetadata.query()
    .findById(tableId)
    .throwIfNotFound({
      message: `Table connection cannot be found for table id: ${tableId}`,
    })

  return {
    position: $.step.position,
    appName: $.app.name,
    connectionName: table.name,
  }
}

export default getTransferDetails
