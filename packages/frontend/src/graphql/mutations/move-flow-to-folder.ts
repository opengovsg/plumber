import { graphql } from '@/graphql/__generated__'

export const MOVE_FLOW_TO_FOLDER = graphql(`
  mutation MoveFlowToFolder($input: MoveFlowToFolderInput!) {
    moveFlowToFolder(input: $input) {
      id
      folder {
        id
        name
        color
      }
    }
  }
`)
