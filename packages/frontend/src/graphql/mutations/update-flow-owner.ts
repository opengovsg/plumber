import { gql } from '@apollo/client'

export const UPDATE_FLOW_OWNER = gql`
  mutation UpdateFlowOwner($input: UpdateFlowOwnerInput!) {
    updateFlowOwner(input: $input) {
      id
      userId
    }
  }
`
