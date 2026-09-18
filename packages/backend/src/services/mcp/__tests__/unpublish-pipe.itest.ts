import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import logger from '@/helpers/logger'
import Flow from '@/models/flow'
import FlowCollaborator from '@/models/flow-collaborators'
import Step from '@/models/step'
import User from '@/models/user'
import flowQueue from '@/queues/flow'

import { unpublishPipeService } from '../unpublish-pipe'

async function createUser(label: string): Promise<User> {
  return User.query().insertAndFetch({
    id: randomUUID(),
    email: `${label}-${randomUUID()}@example.com`,
  })
}

async function createPipe(
  user: User,
  trigger: 'scheduler' | 'webhook',
  active = true,
): Promise<Flow> {
  const flow = await Flow.query().insertAndFetch({
    id: randomUUID(),
    name: `${trigger} pipe`,
    userId: user.id,
    active: false,
    config: {},
  })

  await Step.query().insert([
    {
      flowId: flow.id,
      type: 'trigger',
      position: 1,
      status: 'completed',
      appKey: trigger,
      key: trigger === 'scheduler' ? 'everyHour' : 'catchRawWebhook',
      parameters: {},
    },
    {
      flowId: flow.id,
      type: 'action',
      position: 2,
      status: 'completed',
      appKey: 'custom-api',
      key: 'httpRequest',
      parameters: {},
    },
  ])

  if (!active) {
    return flow
  }

  return flow.$query().patchAndFetch({
    active: true,
    publishedAt: new Date().toISOString(),
  })
}

describe('unpublishPipeService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('unpublishes a scheduled pipe when no repeatable job remains', async () => {
    const owner = await createUser('scheduler-owner')
    const flow = await createPipe(owner, 'scheduler')
    vi.spyOn(logger, 'warn').mockImplementation(() => logger)
    vi.spyOn(flowQueue, 'getRepeatableJobs').mockResolvedValue([])

    const result = await unpublishPipeService(owner, flow.id)
    const updatedFlow = await Flow.query().findById(flow.id)

    expect(result).toEqual({ pipeId: flow.id, active: false })
    expect(updatedFlow.active).toBe(false)
    expect(updatedFlow.publishedAt).toBeNull()
  })

  it('unpublishes a webhook pipe without reading repeatable jobs', async () => {
    const owner = await createUser('webhook-owner')
    const flow = await createPipe(owner, 'webhook')
    const getRepeatableJobs = vi.spyOn(flowQueue, 'getRepeatableJobs')

    await unpublishPipeService(owner, flow.id)

    expect(getRepeatableJobs).not.toHaveBeenCalled()
    const updatedFlow = await Flow.query().findById(flow.id)
    expect(updatedFlow?.active).toBe(false)
  })

  it('returns alreadyInactive without changing the pipe', async () => {
    const owner = await createUser('inactive-owner')
    const flow = await createPipe(owner, 'webhook', false)

    await expect(unpublishPipeService(owner, flow.id)).resolves.toEqual({
      pipeId: flow.id,
      active: false,
      alreadyInactive: true,
    })
  })

  it('allows an editor to unpublish the pipe', async () => {
    const owner = await createUser('editor-owner')
    const editor = await createUser('editor')
    const flow = await createPipe(owner, 'webhook')
    await FlowCollaborator.query().insert({
      flowId: flow.id,
      userId: editor.id,
      role: 'editor',
      updatedBy: owner.id,
    })

    await expect(unpublishPipeService(editor, flow.id)).resolves.toEqual({
      pipeId: flow.id,
      active: false,
    })
  })

  it('does not reveal a pipe to viewers or unknown users', async () => {
    const owner = await createUser('viewer-owner')
    const viewer = await createUser('viewer')
    const unknownUser = await createUser('unknown')
    const flow = await createPipe(owner, 'webhook')
    await FlowCollaborator.query().insert({
      flowId: flow.id,
      userId: viewer.id,
      role: 'viewer',
      updatedBy: owner.id,
    })

    await expect(unpublishPipeService(viewer, flow.id)).rejects.toThrow(
      'Pipe not found',
    )
    await expect(unpublishPipeService(unknownUser, flow.id)).rejects.toThrow(
      'Pipe not found',
    )
  })
})
