import { COMMON_S3_BUCKET, deleteObjects, parseS3Id } from '@/helpers/s3'
import Flow from '@/models/flow'
import Step from '@/models/step'

import { MutationResolvers } from '../__generated__/types.generated'

const deleteUploadedFile: MutationResolvers['deleteUploadedFile'] = async (
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
  // Get all postman steps and update attachments in a single transaction
  await Step.transaction(async (trx) => {
    const steps = await Step.query(trx).where({
      flow_id: flowId,
      app_key: 'postman',
    })

    // Remove attachment from all steps that contain it
    await Promise.all(
      steps.map(
        async (step: {
          id: string
          parameters: { attachments?: string[] }
        }) => {
      const { id: stepId, parameters } = step
      const { attachments = [] } = parameters

      if (attachments.length > 0 && attachments.includes(id)) {
          await Step.query(trx)
            .patch({
              parameters: {
                ...parameters,
                attachments: attachments.filter((a) => a !== id),
              },
            })
            .where('steps.id', stepId)
      }
    },
      ),
  )
  })

  return await deleteObjects(COMMON_S3_BUCKET, [{ Key: objectKey }])
}

export default deleteUploadedFile
