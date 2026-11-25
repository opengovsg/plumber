import type { IFlowConfig } from '@plumber/types'

import { BadUserInputError } from '@/errors/graphql-errors'
import Flow from '@/models/flow'

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

  const changes: Partial<IFlowConfig> = {}
  let removeAttachments = false

  if (
    input.notificationFrequency !== undefined ||
    input.notificationRecipients !== undefined
  ) {
    // A flow without an errorConfig needs both fields, since GraphQL returns them as non-null.
    const notificationFrequency =
      input.notificationFrequency ??
      flow.config?.errorConfig?.notificationFrequency
    const notificationRecipients = input.notificationRecipients
      ? requireNonNullItems(
          input.notificationRecipients,
          'notificationRecipients',
        )
      : flow.config?.errorConfig?.notificationRecipients
    if (!notificationFrequency || !notificationRecipients) {
      throw new BadUserInputError(
        'Missing notificationFrequency or notificationRecipients',
      )
    }
    changes.errorConfig = {
      ...flow.config?.errorConfig,
      notificationFrequency,
      notificationRecipients,
    }
  }

  // Adds uploaded attachments to flow config
  if (input.attachments) {
    changes.attachments = requireNonNullItems(input.attachments, 'attachments')
  } else if (input.attachments === null) {
    removeAttachments = true
  }

  // A raw merge skips the model's JSON schema, so validate the changed keys first.
  Flow.fromJson({ config: changes }, { patch: true })
  // One statement, so a config write made since the read above is kept, such as an MRF pipe's suggestion step ids.
  const current = removeAttachments
    ? `COALESCE(config, '{}'::jsonb) - 'attachments'`
    : `COALESCE(config, '{}'::jsonb)`
  await flow.$query().patch({
    config: Flow.raw(`${current} || ?::jsonb`, [JSON.stringify(changes)]),
    updatedAt: new Date().toISOString(),
    updatedBy: context.currentUser.id,
  })
  return await flow.$query()
}

export default updateFlowConfig
