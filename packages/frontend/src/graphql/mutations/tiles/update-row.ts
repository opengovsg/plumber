import { graphql } from '@/graphql/__generated__'

export const UPDATE_ROW = graphql(`
  mutation UpdateRow($input: UpdateTableRowInput!) {
    updateRow(input: $input)
  }
`)
