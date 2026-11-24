import { graphql } from '@/graphql/__generated__'

export const RENAME_STEP = graphql(`
  mutation RenameStep($input: RenameStepInput!) {
    renameStep(input: $input) {
      id
      # Apollo replaces Step.config whole, so select every field GET_FLOW reads.
      config {
        stepName
        endStepId
        templateConfig {
          appEventKey
          customTemplate
        }
        approval {
          branch
          stepId
        }
      }
      flow {
        id
        updatedAt
      }
    }
  }
`)
