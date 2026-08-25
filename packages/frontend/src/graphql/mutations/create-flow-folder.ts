import { graphql } from '@/graphql/__generated__'

export const CREATE_FLOW_FOLDER = graphql(`
  mutation CreateFlowFolder($input: CreateFlowFolderInput!) {
    createFlowFolder(input: $input) {
      id
      name
      color
      flowCount
    }
  }
`)
