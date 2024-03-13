import { IFlowTransferStatus } from '@plumber/types'

import FlowTransfer from '@/models/flow-transfers'

type Params = {
  input: {
    id: string
    status: IFlowTransferStatus
  }
}

const updateFlowTransferStatus = async (_parent: unknown, params: Params) => {
  const { id, status } = params.input
  const flowTransfer = await FlowTransfer.query()
    .findOne({
      id,
    })
    .throwIfNotFound()

  return await flowTransfer.$query().patchAndFetch({
    status,
  })
}

export default updateFlowTransferStatus
