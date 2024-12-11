import { graphql } from '@/graphql/__generated__'

export const DELETE_FROM_S3 = graphql(`
  mutation DeleteFromS3($id: String!) {
    deleteFromS3(id: $id)
  }
`)
