import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it } from 'vitest'

import updateFlowTransferStatus from '@/graphql/mutations/update-flow-transfer-status'
import Flow from '@/models/flow'
import FlowTransfer from '@/models/flow-transfers'
import Step from '@/models/step'
import User from '@/models/user'
import Context from '@/types/express/context'

import { generateMockContext } from './tiles/table.mock'
import { generateMockFlow, generateMockUser } from './flow.mock'

/**
 * BUSINESS-CRITICAL TESTS. This file pins down the rule
 * `updateFlowTransferStatus` must satisfy:
 *
 *   A. A pipe transfer may only change status while it is still `pending`.
 *      Approving, rejecting or cancelling a transfer that already left
 *      `pending` must fail and must leave pipe ownership untouched.
 *
 * Relaxing this rule is a security vulnerability: a recipient can replay an
 * old transfer id to self-assign Owner on a pipe they no longer have any
 * claim to. STOP and confirm with the user before loosening or deleting an
 * assertion below.
 *
 * General coverage for this mutation lives in
 * `update-flow-transfer-status.itest.ts`.
 */

describe('updateFlowTransferStatus replay protection', () => {
  let context: Context
  let owner: User
  let newOwner: User
  let mockFlow: Flow
  let transfer: FlowTransfer

  beforeEach(async () => {
    context = await generateMockContext()
    owner = context.currentUser
    newOwner = await generateMockUser('editor')

    mockFlow = await generateMockFlow(context, randomUUID())

    await Step.query().insert({
      id: randomUUID(),
      flowId: mockFlow.id,
      key: 'sendMessage',
      appKey: 'slack',
      type: 'action',
      position: 1,
      parameters: { channel: 'general' },
      status: 'completed',
    })

    transfer = await FlowTransfer.query().insert({
      id: randomUUID(),
      flowId: mockFlow.id,
      oldOwnerId: owner.id,
      newOwnerId: newOwner.id,
      status: 'pending',
    })
  })

  async function getFlowOwnerId(): Promise<string> {
    return (await Flow.query().findById(mockFlow.id)).userId
  }

  // Rule A
  it('does not let the new owner approve a cancelled transfer', async () => {
    context.currentUser = owner
    await updateFlowTransferStatus(
      null,
      { input: { id: transfer.id, status: 'cancelled' } },
      context,
    )

    context.currentUser = newOwner
    await expect(
      updateFlowTransferStatus(
        null,
        { input: { id: transfer.id, status: 'approved' } },
        context,
      ),
    ).rejects.toThrow('This pipe transfer is no longer pending')

    expect(await getFlowOwnerId()).toBe(owner.id)
    expect((await FlowTransfer.query().findById(transfer.id)).status).toBe(
      'cancelled',
    )
  })

  // Rule A
  it('does not let the new owner approve a transfer they already rejected', async () => {
    context.currentUser = newOwner
    await updateFlowTransferStatus(
      null,
      { input: { id: transfer.id, status: 'rejected' } },
      context,
    )

    await expect(
      updateFlowTransferStatus(
        null,
        { input: { id: transfer.id, status: 'approved' } },
        context,
      ),
    ).rejects.toThrow('This pipe transfer is no longer pending')

    expect(await getFlowOwnerId()).toBe(owner.id)
  })

  // Rule A
  it('does not let the new owner re-approve an approved transfer', async () => {
    context.currentUser = newOwner
    await updateFlowTransferStatus(
      null,
      { input: { id: transfer.id, status: 'approved' } },
      context,
    )
    expect(await getFlowOwnerId()).toBe(newOwner.id)

    await expect(
      updateFlowTransferStatus(
        null,
        { input: { id: transfer.id, status: 'approved' } },
        context,
      ),
    ).rejects.toThrow('This pipe transfer is no longer pending')
  })

  // Rule A
  it('does not let a past recipient replay their transfer to take ownership back', async () => {
    // First hop: owner -> newOwner.
    context.currentUser = newOwner
    await updateFlowTransferStatus(
      null,
      { input: { id: transfer.id, status: 'approved' } },
      context,
    )

    // Second hop: newOwner -> owner, leaving newOwner as a mere editor.
    const transferBack = await FlowTransfer.query().insert({
      id: randomUUID(),
      flowId: mockFlow.id,
      oldOwnerId: newOwner.id,
      newOwnerId: owner.id,
      status: 'pending',
    })
    context.currentUser = owner
    await updateFlowTransferStatus(
      null,
      { input: { id: transferBack.id, status: 'approved' } },
      context,
    )
    expect(await getFlowOwnerId()).toBe(owner.id)

    // The editor replays the first transfer id to escalate back to Owner.
    context.currentUser = newOwner
    await expect(
      updateFlowTransferStatus(
        null,
        { input: { id: transfer.id, status: 'approved' } },
        context,
      ),
    ).rejects.toThrow('This pipe transfer is no longer pending')

    expect(await getFlowOwnerId()).toBe(owner.id)
  })

  // Rule A
  it('does not let the old owner cancel an approved transfer', async () => {
    context.currentUser = newOwner
    await updateFlowTransferStatus(
      null,
      { input: { id: transfer.id, status: 'approved' } },
      context,
    )

    context.currentUser = owner
    await expect(
      updateFlowTransferStatus(
        null,
        { input: { id: transfer.id, status: 'cancelled' } },
        context,
      ),
    ).rejects.toThrow('This pipe transfer is no longer pending')

    expect((await FlowTransfer.query().findById(transfer.id)).status).toBe(
      'approved',
    )
  })

  // Rule A
  it('approves only once when the same transfer is approved concurrently', async () => {
    context.currentUser = newOwner
    const results = await Promise.allSettled([
      updateFlowTransferStatus(
        null,
        { input: { id: transfer.id, status: 'approved' } },
        context,
      ),
      updateFlowTransferStatus(
        null,
        { input: { id: transfer.id, status: 'approved' } },
        context,
      ),
    ])

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(await getFlowOwnerId()).toBe(newOwner.id)
  })
})
