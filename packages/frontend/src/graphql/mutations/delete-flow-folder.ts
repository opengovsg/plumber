import { graphql } from '@/graphql/__generated__'

export const DELETE_FLOW_FOLDER = graphql(`
  mutation DeleteFlowFolder($input: DeleteFlowFolderInput!) {
    deleteFlowFolder(input: $input)
  }
`)
