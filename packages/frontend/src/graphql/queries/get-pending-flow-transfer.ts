import { gql } from '@apollo/client'

export const GET_PENDING_FLOW_TRANSFER = gql`
  query GetPendingFlowTransfer($flowId: String!) {
    getPendingFlowTransfer(flowId: $flowId) {
      id
      newOwner {
        id
        email
      }
    }
  }
`
