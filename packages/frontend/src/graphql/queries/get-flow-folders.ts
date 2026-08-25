import { graphql } from '@/graphql/__generated__'

export const GET_FLOW_FOLDERS = graphql(`
  query GetFlowFolders {
    getFlowFolders {
      id
      name
      color
      flowCount
    }
  }
`)
