import { BadUserInputError } from '@/errors/graphql-errors'
import { COMMON_S3_BUCKET, deleteObjects, parseS3Id } from '@/helpers/s3'

import type { MutationResolvers } from '../__generated__/types.generated'

const deleteFlow: NonNullable<MutationResolvers['deleteFlow']> = async (
  _parent,
  params,
  context,
) => {
  const { input } = params
  if (!input) {
    throw new BadUserInputError('Missing input')
  }

  const flow = await context.currentUser
    .$relatedQuery('flows')
    .findOne({
      id: input.id,
    })
    .throwIfNotFound()

  /**
   * NOTE: do not delete execution steps similar to delete-step.ts
   * because this operation is expensive for high volume pipes.
   */
  // const executionIds = (
  //  await flow.$relatedQuery('executions').select('executions.id')
  //).map((execution: Execution) => execution.id)

  // await ExecutionStep.query().delete().whereIn('execution_id', executionIds)

  await flow.$relatedQuery('executions').delete()
  await flow.$relatedQuery('steps').delete()
  await flow.$relatedQuery('pendingTransfer').delete()
  await flow.$relatedQuery('flowConnections').delete()

  // delete attachments from s3
  // Note: specify object keys individually, cannot delete entire folder
  if (flow?.config?.attachments) {
    await deleteObjects(
      COMMON_S3_BUCKET,
      flow.config.attachments.map((attachment) => {
        const s3Id = parseS3Id(attachment.value)
        if (!s3Id) {
          throw new Error(
            `Invalid S3 id for flow attachment: ${attachment.name}`,
          )
        }
        return { Key: s3Id.objectKey }
      }),
    )
  }

  await flow.$query().delete()

  return true
}

export default deleteFlow
