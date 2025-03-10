import { graphql } from '@/graphql/__generated__'

export const DELETE_UPLOADED_FILE = graphql(`
  mutation DeleteUploadedFile($id: String!) {
    deleteUploadedFile(id: $id)
  }
`)
