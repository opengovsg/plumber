/* eslint-disable no-console */
import { archivalConfig } from '@/helpers/archival/config'
import { archivalDb } from '@/helpers/archival/db'
import { fetchArchivedExecution } from '@/helpers/archival/fetch-archived-execution'
import { listArchivedExecutions } from '@/helpers/archival/list-archived-executions'
import { restoreExecution } from '@/helpers/archival/restore-execution'
import { archiveS3Client } from '@/helpers/archival/s3-client'

function parseArgs(): {
  flowId: string
  executionId: string | null
  restore: boolean
  bucket: string
} {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const idx = args.indexOf(flag)
    return idx !== -1 ? args[idx + 1] : null
  }

  const flowId = get('--flow-id')
  if (!flowId) {
    console.error(
      'Usage: rehydrate-execution --flow-id <id> [--execution-id <id>] [--restore]',
    )
    process.exit(1)
  }

  return {
    flowId,
    executionId: get('--execution-id'),
    restore: args.includes('--restore'),
    bucket: archivalConfig.archiveBucket,
  }
}

async function main(): Promise<void> {
  const { flowId, executionId, restore, bucket } = parseArgs()
  const opts = { bucket, s3Client: archiveS3Client }

  if (executionId) {
    const payload = await fetchArchivedExecution(flowId, executionId, opts)

    if (restore) {
      const result = await restoreExecution(payload, archivalDb)
      console.log(
        JSON.stringify({
          executionId,
          executionInserted: result.executionInserted,
          stepsInserted: result.stepsInserted,
        }),
      )
    } else {
      console.log(JSON.stringify(payload, null, 2))
    }
  } else {
    const executionIds = await listArchivedExecutions(flowId, opts)

    if (restore) {
      for (const id of executionIds) {
        const payload = await fetchArchivedExecution(flowId, id, opts)
        const result = await restoreExecution(payload, archivalDb)
        console.log(
          JSON.stringify({
            executionId: id,
            executionInserted: result.executionInserted,
            stepsInserted: result.stepsInserted,
          }),
        )
      }
    } else {
      console.log(JSON.stringify(executionIds, null, 2))
    }
  }

  await archivalDb.destroy()
}

main().catch((err) => {
  console.error('rehydrate-execution failed:', err)
  process.exit(1)
})
