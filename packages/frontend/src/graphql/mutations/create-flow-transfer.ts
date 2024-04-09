import { gql } from '@apollo/client'

export const CREATE_FLOW_TRANSFER = gql`
  mutation CreateFlowTransfer($input: CreateFlowTransferInput!) {
    createFlowTransfer(input: $input) {
      id
    }
  }
`
