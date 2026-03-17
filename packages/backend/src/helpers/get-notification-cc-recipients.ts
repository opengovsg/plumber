import { NotificationRecipients } from '@plumber/types'

import Flow from '@/models/flow'

export async function getNotificationCcRecipients(
  flowId: string,
  flow?: Flow,
): Promise<string[]> {
  const ccList: string[] = []
  let erroredFlow = flow ?? null

  if (!erroredFlow) {
    erroredFlow = await Flow.query()
      .findOne({
        id: flowId,
      })
      .withGraphFetched({
        collaborators: {
          user: true,
        },
      })
      .throwIfNotFound({
        message: 'Flow not found',
      })
  }

  // default to notify owner only if no collaborators are specified
  const notificationRecipients =
    erroredFlow.config?.errorConfig?.notificationRecipients ?? []

  if (
    notificationRecipients.length > 0 &&
    erroredFlow.collaborators &&
    erroredFlow.collaborators.length > 0
  ) {
    const collaboratorsToCC = erroredFlow.collaborators
      .filter((collaborator) =>
        notificationRecipients.includes(
          collaborator.role as NotificationRecipients,
        ),
      )
      .map((collaborator) => collaborator.user.email)
    ccList.push(...collaboratorsToCC)
  }

  return ccList
}
