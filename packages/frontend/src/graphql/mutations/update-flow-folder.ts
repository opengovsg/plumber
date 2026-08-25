import { graphql } from '@/graphql/__generated__'

export const UPDATE_FLOW_FOLDER = graphql(`
  mutation UpdateFlowFolder($input: UpdateFlowFolderInput!) {
    updateFlowFolder(input: $input) {
      id
      name
      color
      flowCount
    }
  }
`)
