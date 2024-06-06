import { gql } from '@apollo/client'

export const CREATE_FLOW_TEMPLATE = gql`
  mutation CreateFlowTemplate($input: CreateFlowTemplateInput) {
    createFlowTemplate(input: $input) {
      id
      name
    }
  }
`
