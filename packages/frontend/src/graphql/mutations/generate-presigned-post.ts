import { graphql } from '@/graphql/__generated__'

export const GENERATE_PRESIGNED_POST = graphql(`
  mutation generatePresignedPost($input: GeneratePresignedUrlInput) {
    generatePresignedPost(input: $input) {
      url
      fields
      s3Id
    }
  }
`)
