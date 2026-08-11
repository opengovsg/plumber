import { beforeEach, describe, expect, it, MockInstance, vi } from 'vitest'

import duplicateFlow from '@/graphql/mutations/duplicate-flow'
import logger from '@/helpers/logger'
import Flow from '@/models/flow'
import Step from '@/models/step'
import User from '@/models/user'
import Context from '@/types/express/context'

// Real-DB integration tests for the endStepId forward-reference remap when a
// whole flow is duplicated.
describe('duplicateFlow endStepId remap', () => {
  let owner: User
  let context: Context
  let loggerErrorSpy: MockInstance

  async function seedFlow(
    specs: Array<{
      key: string | null
      appKey: string | null
      type: 'trigger' | 'action'
      config?: Record<string, any>
    }>,
  ): Promise<{ flow: Flow; steps: Step[] }> {
    const flow = await owner.$relatedQuery('flows').insertAndFetch({
      name: 'Source Flow',
      updatedBy: owner.id,
    })
    const steps = (await flow.$relatedQuery('steps').insertAndFetch(
      specs.map((spec, index) => ({
        key: spec.key,
        appKey: spec.appKey,
        type: spec.type,
        position: index + 1,
        parameters: {},
        config: spec.config ?? {},
      })),
    )) as unknown as Step[]
    return { flow, steps }
  }

  const copiedSteps = async (): Promise<Step[]> => {
    const copy = await Flow.query()
      .where('name', '[COPY] Source Flow')
      .first()
      .throwIfNotFound()
    return copy.$relatedQuery('steps').orderBy('position', 'asc')
  }

  beforeEach(async () => {
    vi.restoreAllMocks()
    await Step.query().delete()
    await Flow.query().delete()

    owner = await User.query().findOne({ email: 'tester@open.gov.sg' })
    context = {
      req: null,
      currentUser: owner,
      res: null,
      isAdminOperation: false,
    } as unknown as Context

    loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => null)
  })

  it('remaps a block marker to the copied endStep id', async () => {
    const { flow, steps } = await seedFlow([
      { key: 'newSubmission', appKey: 'formsg', type: 'trigger' },
      { key: 'ifThen', appKey: 'toolbox', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
    ])
    const [, ifThen, s3] = steps
    await ifThen.$query().patch({ config: { endStepId: s3.id } })

    await duplicateFlow(null, { input: { id: flow.id } }, context)

    const copies = await copiedSteps()
    const copiedIfThen = copies[1]
    const copiedS3 = copies[2]
    expect(copiedIfThen.config.endStepId).toBe(copiedS3.id)
    expect(copiedIfThen.config.endStepId).not.toBe(s3.id)
  })

  it('remaps a self-referencing (empty) block to the new self id', async () => {
    const { flow, steps } = await seedFlow([
      { key: 'newSubmission', appKey: 'formsg', type: 'trigger' },
      { key: 'ifThen', appKey: 'toolbox', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
    ])
    const [, ifThen] = steps
    await ifThen.$query().patch({ config: { endStepId: ifThen.id } })

    await duplicateFlow(null, { input: { id: flow.id } }, context)

    const copies = await copiedSteps()
    const copiedIfThen = copies[1]
    expect(copiedIfThen.config.endStepId).toBe(copiedIfThen.id)
    expect(copiedIfThen.config.endStepId).not.toBe(ifThen.id)
  })

  it('rolls back the whole duplication when a source marker is dangling', async () => {
    const { flow, steps } = await seedFlow([
      { key: 'newSubmission', appKey: 'formsg', type: 'trigger' },
      { key: 'ifThen', appKey: 'toolbox', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
    ])
    const [, ifThen] = steps
    await ifThen.$query().patch({ config: { endStepId: 'does-not-exist' } })

    await expect(
      duplicateFlow(null, { input: { id: flow.id } }, context),
    ).rejects.toThrow(/dangling endStepId/)

    const copy = await Flow.query().where('name', '[COPY] Source Flow').first()
    expect(copy).toBeUndefined()
    const original = await Flow.query().findById(flow.id)
    expect(original.config?.duplicateCount).toBeUndefined()
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'duplicate-flow-dangling-end-step',
        danglingSourceStepIds: [ifThen.id],
      }),
    )
  })
})
