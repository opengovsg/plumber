import { COMMON_S3_BUCKET, deleteObjects, parseS3Id } from '@/helpers/s3'
import Flow from '@/models/flow'

import { MutationResolvers } from '../__generated__/types.generated'

const deleteFromS3: MutationResolvers['deleteFromS3'] = async (
  _parent,
  params,
  context,
) => {
  const { id } = params
  const { objectKey } = parseS3Id(id)

  // check if flow belongs to user
  const flowId = objectKey.split('/')[0]
  await Flow.hasAccess(context.currentUser.id, flowId)

  // only postman has attachments
  const steps = await context.currentUser
    .$relatedQuery('steps')
    .where({
      'steps.flow_id': flowId,
      'steps.app_key': 'postman',
    })
    .orderBy('steps.position', 'asc')

  // remove attachment from all steps to prevent execution failure
  const deletePromises = steps.map(
    async (step: { id: string; parameters: { attachments?: string[] } }) => {
      const { id: stepId, parameters } = step
      const { attachments = [] } = parameters

      if (attachments.length > 0 && attachments.includes(id)) {
        await context.currentUser
          .$relatedQuery('steps')
          .patch({
            parameters: {
              ...parameters,
              attachments: attachments.filter((a) => a !== id),
            },
          })
          .where('steps.id', stepId)
      }
    },
  )
  await Promise.allSettled(deletePromises)

  return await deleteObjects(COMMON_S3_BUCKET, [{ Key: objectKey }])
}

export default deleteFromS3
