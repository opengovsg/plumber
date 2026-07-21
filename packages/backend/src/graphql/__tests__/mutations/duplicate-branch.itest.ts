import { beforeEach, describe, expect, it, MockInstance, vi } from 'vitest'

import duplicateBranch from '@/graphql/mutations/duplicate-branch'
import logger from '@/helpers/logger'
import Flow from '@/models/flow'
import Step from '@/models/step'
import User from '@/models/user'
import Context from '@/types/express/context'

// Real-DB integration tests for the DB-derived endStepId remap when a branch
// (contiguous selection) is duplicated. Markers are read from the source rows,
// never from the client-sent config.
describe('duplicateBranch endStepId remap', () => {
  let owner: User
  let context: Context
  let testFlow: Flow
  let loggerInfoSpy: MockInstance

  const flowInput = () => ({
    id: testFlow.id,
    updatedAt: new Date(testFlow.updatedAt).getTime().toString(),
  })

  async function seedSteps(
    specs: Array<{
      key: string | null
      appKey: string | null
      type: 'trigger' | 'action'
      config?: Record<string, any>
    }>,
  ): Promise<Step[]> {
    return testFlow.$relatedQuery('steps').insertAndFetch(
      specs.map((spec, index) => ({
        key: spec.key,
        appKey: spec.appKey,
        type: spec.type,
        position: index + 1,
        parameters: {},
        config: spec.config ?? {},
      })),
    ) as unknown as Promise<Step[]>
  }

  const reload = async (id: string): Promise<Step> =>
    Step.query().findById(id).throwIfNotFound()

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

    testFlow = await owner.$relatedQuery('flows').insertAndFetch({
      name: 'Branch Flow',
      updatedBy: owner.id,
    })

    loggerInfoSpy = vi.spyOn(logger, 'info').mockImplementation(() => null)
    vi.spyOn(Flow.prototype, 'patchLastUpdated').mockResolvedValue({
      updatedAt: testFlow.updatedAt,
    } as any)
  })

  it('remaps an intra-selection marker DB-derived, ignoring the client-sent value', async () => {
    // Block [ifThen, member], endStep = member; a trailing step follows.
    const [, ifThen, member] = await seedSteps([
      { key: 'newSubmission', appKey: 'formsg', type: 'trigger' },
      { key: 'ifThen', appKey: 'toolbox', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
    ])
    await ifThen.$query().patch({ config: { endStepId: member.id } })

    const result = await duplicateBranch(
      null,
      {
        input: {
          flow: flowInput(),
          previousStep: { id: member.id },
          steps: [
            {
              key: 'ifThen',
              appKey: 'toolbox',
              parameters: {},
              // A bogus client-sent marker that must be ignored.
              config: { endStepId: 'client-bogus' },
            },
            {
              key: 'sendTransactionalEmail',
              appKey: 'postman',
              parameters: {},
            },
          ],
        },
      },
      context,
    )

    const [copiedIfThen, copiedMember] = result.steps
    const reloaded = await reload(copiedIfThen.id)
    expect(reloaded.config.endStepId).toBe(copiedMember.id)
    expect(reloaded.config.endStepId).not.toBe('client-bogus')
    expect(reloaded.config.endStepId).not.toBe(member.id)
  })

  it('remaps a self-referencing (empty) block to its own copy', async () => {
    const [, ifThen] = await seedSteps([
      { key: 'newSubmission', appKey: 'formsg', type: 'trigger' },
      { key: 'ifThen', appKey: 'toolbox', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
    ])
    await ifThen.$query().patch({ config: { endStepId: ifThen.id } })

    const result = await duplicateBranch(
      null,
      {
        input: {
          flow: flowInput(),
          previousStep: { id: ifThen.id },
          steps: [{ key: 'ifThen', appKey: 'toolbox', parameters: {} }],
        },
      },
      context,
    )

    const [copiedIfThen] = result.steps
    expect((await reload(copiedIfThen.id)).config.endStepId).toBe(
      copiedIfThen.id,
    )
  })

  it('leaves the copy marker-less and logs when the source marker points outside the selection', async () => {
    // Block spans [ifThen, member, tail]; duplicating only [ifThen, member]
    // leaves the endStep (tail) outside the selection.
    const [, ifThen, member, tail] = await seedSteps([
      { key: 'newSubmission', appKey: 'formsg', type: 'trigger' },
      { key: 'ifThen', appKey: 'toolbox', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
    ])
    await ifThen.$query().patch({ config: { endStepId: tail.id } })

    const result = await duplicateBranch(
      null,
      {
        input: {
          flow: flowInput(),
          previousStep: { id: member.id },
          steps: [
            { key: 'ifThen', appKey: 'toolbox', parameters: {} },
            {
              key: 'sendTransactionalEmail',
              appKey: 'postman',
              parameters: {},
            },
          ],
        },
      },
      context,
    )

    const [copiedIfThen] = result.steps
    expect((await reload(copiedIfThen.id)).config.endStepId).toBeUndefined()
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'duplicate-branch-stripped-end-step',
        sourceStepId: ifThen.id,
      }),
    )
  })
})
