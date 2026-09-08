import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UserFacingError } from '@/errors/user-facing-error'
import Flow from '@/models/flow'
import FlowConnections from '@/models/flow-connections'
import TableCollaborator from '@/models/table-collaborators'

import {
  generateMockCollaborator,
  generateMockUser,
} from '../../../graphql/__tests__/mutations/flow.mock'
import { generateMockContext } from '../../../graphql/__tests__/mutations/tiles/table.mock'
import { checkIfTableExists } from '../../../graphql/__tests__/mutations/tiles/tiles-pg-helper'
import { createTileService } from '../create-tile'

const mocks = vi.hoisted(() => ({
  getLdFlagValue: vi.fn().mockResolvedValue('pg'),
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getLdFlagValue: mocks.getLdFlagValue,
}))

describe('createTileService', () => {
  beforeEach(() => {
    mocks.getLdFlagValue.mockResolvedValue('pg')
  })

  it('creates a tile with named columns and no placeholder rows', async () => {
    const context = await generateMockContext()
    const result = await createTileService({
      user: context.currentUser,
      name: '  Leave applications  ',
      columns: ['Applicant name', 'Start date'],
    })

    expect(result.name).toBe('Leave applications')
    expect(result.columns).toHaveLength(2)
    expect(result.columns.map((column) => column.name)).toEqual([
      'Applicant name',
      'Start date',
    ])
    expect(result.columns[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    expect(await checkIfTableExists(result.id)).toBe(true)
  })

  it('wires pipe collaborators when pipeId is provided', async () => {
    const context = await generateMockContext()
    const flow = await Flow.query().insert({
      id: randomUUID(),
      name: 'Test Flow',
      userId: context.currentUser.id,
    })
    const editor = await generateMockUser('editor')
    await generateMockCollaborator(
      flow.id,
      editor.id,
      context.currentUser.id,
      'editor',
    )

    const result = await createTileService({
      user: context.currentUser,
      name: 'Flow Tile',
      columns: ['Status'],
      pipeId: flow.id,
    })

    const editorCollab = await TableCollaborator.query().findOne({
      user_id: editor.id,
      table_id: result.id,
    })
    expect(editorCollab?.role).toBe('editor')

    const flowConnection = await FlowConnections.query().findOne({
      flow_id: flow.id,
      connection_id: result.id,
    })
    expect(flowConnection?.connectionType).toBe('table')
  })

  it('rejects an unknown pipe before creating a tile', async () => {
    const context = await generateMockContext()
    await expect(
      createTileService({
        user: context.currentUser,
        name: 'Orphan',
        columns: ['A'],
        pipeId: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(UserFacingError)
  })
})
