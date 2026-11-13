import { gql } from '@apollo/client'

export const CREATE_TEMPLATE_FROM_FLOW = gql`
  mutation CreateTemplateFromFlow($input: CreateTemplateFromFlowInput!) {
    createTemplateFromFlow(input: $input) {
      id
      name
    }
  }
`
