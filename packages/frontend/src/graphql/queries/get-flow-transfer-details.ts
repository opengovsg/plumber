import { gql } from '@apollo/client'

export const GET_FLOW_TRANSFER_DETAILS = gql`
  query getFlowTransferDetails($flowId: String!) {
    getFlowTransferDetails(flowId: $flowId) {
      position
      appName
      connectionName
      instructions
    }
  }
`
