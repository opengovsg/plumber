import { randomUUID } from 'crypto'

import { beforeEach, describe, expect, it } from 'vitest'

import deleteConnection from '@/graphql/mutations/delete-connection'
import Connection from '@/models/connection'
import Flow from '@/models/flow'
import FlowConnections from '@/models/flow-connections'
import Step from '@/models/step'
import User from '@/models/user'
import Context from '@/types/express/context'

import {
  generateMockCollaborator,
  generateMockFlow,
  generateMockStep,
  generateMockUser,
} from './flow.mock'
import { generateMockContext } from './tiles/table.mock'

describe('deleteConnection', () => {
  let context: Context
  let owner: User
  let connection: Connection

  const createFlowUsingConnection = async ({
    name,
    active,
    owningContext = context,
  }: {
    name: string
    active: boolean
    owningContext?: Context
  }) => {
    const flow = await generateMockFlow(owningContext, randomUUID())
    await Flow.query().findById(flow.id).patch({ name })
    const step = await generateMockStep(
      owningContext,
      'createTableRow',
      'm365-excel',
      'action',
      flow.id,
      2,
    )
    await Step.query().findById(step.id).patch({ connectionId: connection.id })
    // IMPORTANT: Publish last. Step hooks reject edits to a published pipe.
    // Knex skips Flow.$beforeUpdate, which rejects publishing incomplete steps.
    await Flow.knex().table('flows').where('id', flow.id).update({ active })
    return flow
  }

  beforeEach(async () => {
    await FlowConnections.query().delete()
    await Step.query().delete()
    await Flow.query().delete()
    await Connection.query().delete()

    context = await generateMockContext()
    owner = context.currentUser

    connection = await Connection.query().insertAndFetch({
      userId: owner.id,
      key: 'm365-excel',
      formattedData: { screenName: 'Test M365' },
      verified: true,
    })
  })

  it('deletes a connection that no pipe uses', async () => {
    const result = await deleteConnection(
      {},
      { input: { id: connection.id } },
      context,
    )

    expect(result).toBe(true)
    expect(await Connection.query().findById(connection.id)).toBeUndefined()
  })

  it('deletes a connection that is only used by an unpublished pipe', async () => {
    await createFlowUsingConnection({ name: 'Draft pipe', active: false })

    const result = await deleteConnection(
      {},
      { input: { id: connection.id } },
      context,
    )

    expect(result).toBe(true)
    expect(await Connection.query().findById(connection.id)).toBeUndefined()
  })

  it('deletes a connection when the only published pipe using it is deleted', async () => {
    const flow = await createFlowUsingConnection({
      name: 'Removed pipe',
      active: true,
    })
    await Flow.query().findById(flow.id).delete()

    const result = await deleteConnection(
      {},
      { input: { id: connection.id } },
      context,
    )

    expect(result).toBe(true)
  })

  it('blocks deletion when a published pipe uses the connection', async () => {
    await createFlowUsingConnection({ name: 'Live pipe', active: true })

    await expect(
      deleteConnection({}, { input: { id: connection.id } }, context),
    ).rejects.toThrow('This connection is used by a published pipe.')

    expect(await Connection.query().findById(connection.id)).toBeDefined()
  })

  it('blocks deletion when any one of several pipes is published', async () => {
    await createFlowUsingConnection({ name: 'Pipe A', active: true })
    await createFlowUsingConnection({ name: 'Pipe C', active: false })

    await expect(
      deleteConnection({}, { input: { id: connection.id } }, context),
    ).rejects.toThrow('published pipe')
  })

  it('still deletes the connection after the pipe is unpublished', async () => {
    const flow = await createFlowUsingConnection({
      name: 'Live pipe',
      active: true,
    })
    await expect(
      deleteConnection({}, { input: { id: connection.id } }, context),
    ).rejects.toThrow()

    await Flow.query().findById(flow.id).patch({ active: false })

    const result = await deleteConnection(
      {},
      { input: { id: connection.id } },
      context,
    )
    expect(result).toBe(true)
  })

  it('blocks deletion when the published pipe is owned by a collaborator', async () => {
    const otherUser = await generateMockUser('nonCollaborator')
    const otherContext = { ...context, currentUser: otherUser } as Context
    const flow = await createFlowUsingConnection({
      name: 'Shared pipe',
      active: true,
      owningContext: otherContext,
    })
    await generateMockCollaborator(flow.id, owner.id, otherUser.id, 'editor')

    await expect(
      deleteConnection({}, { input: { id: connection.id } }, context),
    ).rejects.toThrow('published pipe')
  })

  it('throws not found for a connection the user does not own', async () => {
    const otherUser = await generateMockUser('nonCollaborator')
    const otherConnection = await Connection.query().insertAndFetch({
      userId: otherUser.id,
      key: 'm365-excel',
      formattedData: { screenName: 'Other M365' },
      verified: true,
    })

    await expect(
      deleteConnection({}, { input: { id: otherConnection.id } }, context),
    ).rejects.toThrow()
    expect(await Connection.query().findById(otherConnection.id)).toBeDefined()
  })
})
