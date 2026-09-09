import type { IFlowConfig } from '@plumber/types'

import { BadUserInputError } from '@/errors/graphql-errors'

import type { MutationResolvers } from '../__generated__/types.generated'

function requireNonNullItems<T>(
  items: (T | null | undefined)[],
  fieldName: string,
): T[] {
  return items.map((item) => {
    if (item == null) {
      throw new BadUserInputError(`Invalid ${fieldName}`)
    }
    return item
  })
}

const updateFlowConfig: NonNullable<
  MutationResolvers['updateFlowConfig']
> = async (_parent, params, context) => {
  const { input } = params
  if (!input) {
    throw new BadUserInputError('Missing input')
  }

  const flow = await context.currentUser
    .withAccessibleFlows({ requiredRole: 'editor' })
    .findOne({
      id: input.id,
    })
    .throwIfNotFound({ message: 'Not authorised!' })

  const newConfig: IFlowConfig = {
    ...flow.config,
  }

  if (
    input.notificationFrequency !== undefined ||
    input.notificationRecipients !== undefined
  ) {
    // A flow without an errorConfig needs both fields, since GraphQL returns them as non-null.
    const notificationFrequency =
      input.notificationFrequency ??
      newConfig.errorConfig?.notificationFrequency
    const notificationRecipients = input.notificationRecipients
      ? requireNonNullItems(
          input.notificationRecipients,
          'notificationRecipients',
        )
      : newConfig.errorConfig?.notificationRecipients
    if (!notificationFrequency || !notificationRecipients) {
      throw new BadUserInputError(
        'Missing notificationFrequency or notificationRecipients',
      )
    }
    newConfig.errorConfig = {
      ...newConfig.errorConfig,
      notificationFrequency,
      notificationRecipients,
    }
  }

  // Adds uploaded attachments to flow config
  if (input.attachments !== undefined) {
    newConfig.attachments = input.attachments
      ? requireNonNullItems(input.attachments, 'attachments')
      : undefined
  }

  return await flow.$query().patchAndFetch({
    config: newConfig,
    updatedAt: new Date().toISOString(),
    updatedBy: context.currentUser.id,
  })
}

export default updateFlowConfig
