import { graphql } from '@/graphql/__generated__'

export const GENERATE_PRESIGNED_POST = graphql(`
  mutation generatePresignedPost($input: GeneratePresignedPostInput) {
    generatePresignedPost(input: $input) {
      presignedPost {
        url
        fields
      }
      s3Id
    }
  }
`)
