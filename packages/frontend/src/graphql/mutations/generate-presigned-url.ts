import { graphql } from '@/graphql/__generated__'

export const GENERATE_PRESIGNED_URL = graphql(`
  mutation generatePresignedUrl($input: GeneratePresignedUrlInput) {
    generatePresignedUrl(input: $input) {
      url
      s3Id
    }
  }
`)
