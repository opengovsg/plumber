import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'

import { S3_PREFIX_EXECUTIONS } from './build-s3-key'

type ListOpts = {
  bucket: string
  s3Client: S3Client
}

// Intentionally only lists production executions. Test-run executions are
// archived under S3_PREFIX_TEST_EXECUTIONS but are never rehydrated.
export async function listArchivedExecutions(
  flowId: string,
  opts: ListOpts,
): Promise<string[]> {
  const prefix = `${S3_PREFIX_EXECUTIONS}/flow_id=${flowId}/`
  const executionIds: string[] = []
  let continuationToken: string | undefined

  do {
    const response = await opts.s3Client.send(
      new ListObjectsV2Command({
        Bucket: opts.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    )

    for (const obj of response.Contents ?? []) {
      const match = obj.Key?.match(/execution_id=([^/]+)\.json\.gz$/)
      if (match) {
        executionIds.push(match[1])
      }
    }

    continuationToken = response.NextContinuationToken
  } while (continuationToken)

  return executionIds
}
