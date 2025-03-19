import { COMMON_S3_BUCKET, deleteObjects, parseS3Id } from '@/helpers/s3'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'

import type { MutationResolvers } from '../__generated__/types.generated'

const deleteFlow: MutationResolvers['deleteFlow'] = async (
  _parent,
  params,
  context,
) => {
  const flow = await context.currentUser
    .$relatedQuery('flows')
    .findOne({
      id: params.input.id,
    })
    .throwIfNotFound()

  const executionIds = (
    await flow.$relatedQuery('executions').select('executions.id')
  ).map((execution: Execution) => execution.id)

  await ExecutionStep.query().delete().whereIn('execution_id', executionIds)

  await flow.$relatedQuery('executions').delete()
  await flow.$relatedQuery('steps').delete()

  // delete attachments from s3
  // Note: specify object keys individually, cannot delete entire folder
  if (flow?.config?.attachments) {
    await deleteObjects(
      COMMON_S3_BUCKET,
      flow.config.attachments.map((attachment) => ({
        Key: parseS3Id(attachment.value).objectKey,
      })),
    )
  }

  await flow.$query().delete()

  return true
}

export default deleteFlow
