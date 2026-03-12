import { graphql } from '@/graphql/__generated__'

export const SET_TABLE_VIEW_PASSWORD = graphql(`
  mutation SetTableViewPassword($input: SetTableViewPasswordInput!) {
    setTableViewPassword(input: $input)
  }
`)
