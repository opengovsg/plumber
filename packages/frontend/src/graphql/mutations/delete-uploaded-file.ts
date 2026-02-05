import { graphql } from '@/graphql/__generated__'

export const DELETE_UPLOADED_FILE = graphql(`
  mutation DeleteUploadedFile($id: String!, $flowUpdatedAt: String!) {
    deleteUploadedFile(id: $id, flowUpdatedAt: $flowUpdatedAt)
  }
`)
