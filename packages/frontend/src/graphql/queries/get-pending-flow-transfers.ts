import { gql } from '@apollo/client'

export const GET_PENDING_FLOW_TRANSFERS = gql`
  query GetPendingFlowTransfers {
    getPendingFlowTransfers {
      id
      flowId
      oldOwner {
        id
        email
      }
      newOwner {
        id
        email
      }
      flow {
        id
        name
      }
    }
  }
`
