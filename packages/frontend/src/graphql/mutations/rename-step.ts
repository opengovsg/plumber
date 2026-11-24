import { graphql } from '@/graphql/__generated__'

export const RENAME_STEP = graphql(`
  mutation RenameStep($input: RenameStepInput!) {
    renameStep(input: $input) {
      id
      config {
        stepName
      }
      flow {
        id
        updatedAt
      }
    }
  }
`)
