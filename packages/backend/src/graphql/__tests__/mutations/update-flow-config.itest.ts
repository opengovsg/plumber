import type { IFlowConfig } from '@plumber/types'
import { beforeEach, describe, expect, it } from 'vitest'

import updateFlowConfig from '@/graphql/mutations/update-flow-config'
import Flow from '@/models/flow'

import { generateMockContext } from './tiles/table.mock'

const suggestion = { position: 1, appKey: 'formsg', key: 'newSubmission' }
const attachment = {
  name: 'form.pdf',
  displayedValue: 'form.pdf',
  value: 's3://bucket/form.pdf',
  size: 10,
  updatedAt: '2026-11-25T00:00:00.000Z',
}

describe('updateFlowConfig', () => {
  let context: Awaited<ReturnType<typeof generateMockContext>>
  let flowId: string

  const storedConfig = async (): Promise<IFlowConfig | null> =>
    (await Flow.query().findById(flowId).throwIfNotFound()).config

  beforeEach(async () => {
    context = await generateMockContext()
    const flow = await context.currentUser
      .$relatedQuery('flows')
      .insertAndFetch({
        name: 'MRF pipe',
        config: {
          attachments: [attachment],
          aiBuilderConfig: { traceId: 'trace-1', suggested: [suggestion] },
        },
      })
    flowId = flow.id
    // The settings save reads the pipe before the MRF actions commit their step ids.
    context.currentUser.withAccessibleFlows = (() => ({
      findOne: () => ({ throwIfNotFound: async () => flow }),
    })) as unknown as typeof context.currentUser.withAccessibleFlows
    await Flow.transaction((trx) =>
      Flow.saveAiBuilderSuggestions(
        flowId,
        [{ ...suggestion, stepId: 'trigger-step' }],
        trx,
      ),
    )
  })

  it('keeps suggestion step ids written after it read the pipe', async () => {
    const result = await updateFlowConfig(
      {},
      {
        input: {
          id: flowId,
          notificationFrequency: 'once_per_day',
          notificationRecipients: ['editor'],
        },
      },
      context,
    )

    expect(await storedConfig()).toEqual({
      attachments: [attachment],
      aiBuilderConfig: {
        traceId: 'trace-1',
        suggested: [{ ...suggestion, stepId: 'trigger-step' }],
      },
      errorConfig: {
        notificationFrequency: 'once_per_day',
        notificationRecipients: ['editor'],
      },
    })
    expect(result?.config).toEqual(await storedConfig())
  })

  // GraphQL rejects an unknown recipient first. This checks the raw merge still applies the model's schema.
  it('rejects an invalid recipient without writing', async () => {
    await expect(
      updateFlowConfig(
        {},
        {
          input: {
            id: flowId,
            notificationFrequency: 'once_per_day',
            notificationRecipients: ['owner' as 'editor'],
          },
        },
        context,
      ),
    ).rejects.toThrow('must be equal to one of the allowed values')
    expect((await storedConfig())?.errorConfig).toBeUndefined()
  })

  it('removes the attachments and keeps the rest', async () => {
    await updateFlowConfig(
      {},
      { input: { id: flowId, attachments: null } },
      context,
    )

    expect(await storedConfig()).toEqual({
      aiBuilderConfig: {
        traceId: 'trace-1',
        suggested: [{ ...suggestion, stepId: 'trigger-step' }],
      },
    })
  })
})
