import { gql } from '@apollo/client'

export const GET_FLOW_CONNECTIONS = gql`
  query GetFlowConnections($flowId: String!) {
    getFlowConnections(flowId: $flowId) {
      flowId
      connectionId
      connectionType
      appName
      appIconUrl
      addedBy
      connectionName
      isDeletable
    }
  }
`
