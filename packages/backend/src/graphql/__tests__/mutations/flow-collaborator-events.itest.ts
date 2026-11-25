import { randomUUID } from 'crypto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import deleteFlowCollaborator from '@/graphql/mutations/delete-flow-collaborator'
import updateFlowTransferStatus from '@/graphql/mutations/update-flow-transfer-status'
import upsertFlowCollaborator from '@/graphql/mutations/upsert-flow-collaborator'
import { captureServerEvent } from '@/helpers/server-events'
import Flow from '@/models/flow'
import FlowCollaborator from '@/models/flow-collaborators'
import FlowTransfer from '@/models/flow-transfers'
import Step from '@/models/step'
import User from '@/models/user'
import Context from '@/types/express/context'

import { generateMockContext } from './tiles/table.mock'

vi.mock('@/helpers/server-events', () => ({
  captureServerEvent: vi.fn(),
}))

const capture = vi.mocked(captureServerEvent)

function sentEvents() {
  return capture.mock.calls.map(([event]) => ({
    event: event.event,
    ...event.properties,
  }))
}

// Waits until another connection is blocked on a row lock, so the test commits only after the mutation reaches it.
async function waitForLockWait(): Promise<void> {
  for (let i = 0; i < 100; i++) {
    const { rows } = await Flow.knex().raw(
      "select count(*)::int as n from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'",
    )
    if (rows[0].n > 0) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error('No query waited on the lock')
}

describe('flow collaborator events', () => {
  let context: Context
  let flow: Flow
  let collaborator: User

  async function upsert(role: 'editor' | 'viewer') {
    await upsertFlowCollaborator(
      {},
      { input: { flowId: flow.id, email: collaborator.email, role } },
      context,
    )
  }

  beforeEach(async () => {
    capture.mockClear()
    context = await generateMockContext()
    flow = await Flow.query().insert({
      id: randomUUID(),
      name: 'shared pipe',
      userId: context.currentUser.id,
    })
    collaborator = await User.query().insert({
      id: randomUUID(),
      email: `collaborator-${randomUUID()}@plumber.gov.sg`,
    })
  })

  it('sends one event per real change, with the history the table overwrites', async () => {
    await upsert('viewer')
    await upsert('viewer')
    await upsert('editor')
    await deleteFlowCollaborator(
      {},
      { input: { flowId: flow.id, email: collaborator.email } },
      context,
    )
    await upsert('viewer')

    const base = { flow_id: flow.id, collaborator_user_id: collaborator.id }
    expect(sentEvents()).toEqual([
      {
        event: 'flow_collaborator_added',
        ...base,
        source: 'app',
        role: 'viewer',
      },
      {
        event: 'flow_collaborator_role_changed',
        ...base,
        source: 'app',
        role: 'editor',
        previous_role: 'viewer',
      },
      {
        event: 'flow_collaborator_removed',
        ...base,
        source: 'app',
        previous_role: 'editor',
      },
      {
        event: 'flow_collaborator_added',
        ...base,
        source: 'app',
        role: 'viewer',
      },
    ])
    expect(
      capture.mock.calls.every(
        ([e]) => e.distinctId === context.currentUser.id,
      ),
    ).toBe(true)
  })

  it('marks a collaborator removing themself as left', async () => {
    await upsert('editor')
    capture.mockClear()

    const owner = context.currentUser
    context.currentUser = collaborator
    await deleteFlowCollaborator(
      {},
      { input: { flowId: flow.id, email: collaborator.email } },
      context,
    )
    context.currentUser = owner

    expect(capture).toHaveBeenCalledOnce()
    expect(capture.mock.calls[0][0]).toMatchObject({
      distinctId: collaborator.id,
      event: 'flow_collaborator_removed',
      properties: { source: 'left', previous_role: 'editor' },
    })
  })

  it('records a transfer as the old owner joining and the new owner leaving the collaborators', async () => {
    await upsert('editor')
    await Step.query().insert({
      id: randomUUID(),
      flowId: flow.id,
      key: 'sendMessage',
      appKey: 'slack',
      type: 'action',
      position: 1,
      parameters: {},
      status: 'completed',
    })
    const transfer = await FlowTransfer.query().insert({
      id: randomUUID(),
      flowId: flow.id,
      oldOwnerId: context.currentUser.id,
      newOwnerId: collaborator.id,
      status: 'pending',
    })
    const oldOwner = context.currentUser
    capture.mockClear()

    context.currentUser = collaborator
    await updateFlowTransferStatus(
      {},
      { input: { id: transfer.id, status: 'approved' } },
      context,
    )

    expect(sentEvents()).toEqual([
      {
        event: 'flow_collaborator_added',
        flow_id: flow.id,
        collaborator_user_id: oldOwner.id,
        source: 'transfer',
        role: 'editor',
      },
      {
        event: 'flow_collaborator_removed',
        flow_id: flow.id,
        collaborator_user_id: collaborator.id,
        source: 'transfer',
        previous_role: 'editor',
      },
    ])
  })

  it('sends added when a removal commits while a same-role save runs', async () => {
    await upsert('viewer')
    capture.mockClear()

    const removal = await Flow.knex().transaction()
    await FlowCollaborator.query(removal)
      .patch({ deletedAt: new Date().toISOString() })
      .where({ flow_id: flow.id, user_id: collaborator.id })
    const save = upsert('viewer')
    await waitForLockWait()
    await removal.commit()
    await save

    expect(sentEvents()).toEqual([
      {
        event: 'flow_collaborator_added',
        flow_id: flow.id,
        collaborator_user_id: collaborator.id,
        source: 'app',
        role: 'viewer',
      },
    ])
  })

  it('sends the role a transfer removed when an edit commits during the transfer', async () => {
    await upsert('viewer')
    const transfer = await FlowTransfer.query().insert({
      id: randomUUID(),
      flowId: flow.id,
      oldOwnerId: context.currentUser.id,
      newOwnerId: collaborator.id,
      status: 'pending',
    })
    capture.mockClear()

    const edit = await Flow.knex().transaction()
    await FlowCollaborator.query(edit)
      .patch({ role: 'editor' })
      .where({ flow_id: flow.id, user_id: collaborator.id })
    context.currentUser = collaborator
    const approval = updateFlowTransferStatus(
      {},
      { input: { id: transfer.id, status: 'approved' } },
      context,
    )
    await waitForLockWait()
    await edit.commit()
    await approval

    expect(sentEvents()).toContainEqual({
      event: 'flow_collaborator_removed',
      flow_id: flow.id,
      collaborator_user_id: collaborator.id,
      source: 'transfer',
      previous_role: 'editor',
    })
  })

  it('sends nothing when the change rolls back', async () => {
    const outsider = await User.query().insert({
      id: randomUUID(),
      email: `outsider-${randomUUID()}@plumber.gov.sg`,
    })
    context.currentUser = outsider

    await expect(upsert('viewer')).rejects.toThrow()
    expect(capture).not.toHaveBeenCalled()
  })
})
