import { gql } from '@apollo/client'

export const UPDATE_FLOW_TRANSFER_STATUS = gql`
  mutation UpdateFlowTransferStatus($input: UpdateFlowTransferStatusInput) {
    updateFlowTransferStatus(input: $input) {
      id
      status
    }
  }
`
