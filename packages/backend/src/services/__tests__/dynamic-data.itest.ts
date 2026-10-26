import { randomUUID } from 'crypto'

import type { IDynamicData, IJSONObject } from '@plumber/types'
import { beforeEach, describe, expect, it } from 'vitest'

import Connection from '@/models/connection'
import Flow from '@/models/flow'
import FlowCollaborator from '@/models/flow-collaborators'
import FlowConnections from '@/models/flow-connections'
import Step from '@/models/step'
import User from '@/models/user'
import { loadAccessibleStep } from '@/services/access'

import {
  runStepDynamicData,
  shouldRunDynamicDataAsOwner,
} from '../dynamic-data'

type Role = 'owner' | 'editor' | 'viewer'

const TILES_KEY = 'listTables'
const FILES_KEY = 'listFiles'

async function insertUser(label: string): Promise<User> {
  return User.query().insertAndFetch({
    id: randomUUID(),
    email: `dynamic-data-${label}-${randomUUID()}@example.com`,
  })
}

function command(
  key: string,
  output: {
    data: Array<{ name: string; value: string }>
    error?: IJSONObject
  },
  seen?: { userId?: string; parameters?: IJSONObject },
): IDynamicData {
  return {
    name: key,
    key,
    async run($) {
      if (seen) {
        seen.userId = $.user?.id
        seen.parameters = $.step?.parameters
      }
      return output
    },
  }
}

describe('dynamic data', () => {
  let users: Record<Role, User>
  let tilesStepId: string
  let filesStepId: string
  let sharedTileId: string
  let privateTileId: string
  const allowedFile = 'file-allowed'
  const hiddenFile = 'file-hidden'

  beforeEach(async () => {
    users = {
      owner: await insertUser('owner'),
      editor: await insertUser('editor'),
      viewer: await insertUser('viewer'),
    }
    const flow = await Flow.query().insertAndFetch({
      id: randomUUID(),
      userId: users.owner.id,
      name: 'Dynamic data pipe',
      active: false,
    })
    await FlowCollaborator.query().insert([
      {
        flowId: flow.id,
        userId: users.editor.id,
        role: 'editor',
        updatedBy: users.owner.id,
      },
      {
        flowId: flow.id,
        userId: users.viewer.id,
        role: 'viewer',
        updatedBy: users.owner.id,
      },
    ])
    await Step.query().insert({
      id: randomUUID(),
      flowId: flow.id,
      appKey: null,
      key: null,
      type: 'trigger',
      position: 1,
      parameters: {},
      status: 'incomplete',
    })

    sharedTileId = randomUUID()
    privateTileId = randomUUID()
    const tilesStep = await Step.query().insertAndFetch({
      id: randomUUID(),
      flowId: flow.id,
      appKey: 'tiles',
      key: 'createTileRow',
      type: 'action',
      position: 2,
      parameters: { existingParam: 'keep-me' },
      status: 'incomplete',
    })
    tilesStepId = tilesStep.id
    await FlowConnections.query().insert({
      flowId: flow.id,
      connectionId: sharedTileId,
      addedBy: users.owner.id,
      connectionType: 'table',
    })

    const connection = await Connection.query().insertAndFetch({
      id: randomUUID(),
      key: 'm365-excel',
      userId: users.owner.id,
      verified: true,
      formattedData: { screenName: 'Excel' },
    })
    const filesStep = await Step.query().insertAndFetch({
      id: randomUUID(),
      flowId: flow.id,
      appKey: 'm365-excel',
      key: 'createTableRow',
      type: 'action',
      position: 3,
      connectionId: connection.id,
      parameters: {},
      status: 'incomplete',
    })
    filesStepId = filesStep.id
    await FlowConnections.query().insert({
      flowId: flow.id,
      connectionId: connection.id,
      addedBy: users.owner.id,
      connectionType: 'connection',
      metadata: { fileId: [allowedFile] },
    })
  })

  async function loadStep(role: Role, stepId: string): Promise<Step> {
    const step = await loadAccessibleStep({
      user: users[role],
      stepId,
      role: 'viewer',
      graph: {
        connection: true,
        flow: {
          user: true,
        },
      },
    })
    if (!step) {
      throw new Error(`missing step for ${role}`)
    }
    return step
  }

  describe('shouldRunDynamicDataAsOwner', () => {
    it.each([
      ['tiles', 'owner', false],
      ['tiles', 'editor', false],
      ['tiles', 'viewer', true],
      ['m365-excel', 'owner', true],
      ['m365-excel', 'editor', true],
      ['m365-excel', 'viewer', true],
    ] as const)('%s %s -> %s', async (appKey, role, expected) => {
      const step = await loadStep(
        role,
        appKey === 'tiles' ? tilesStepId : filesStepId,
      )

      expect(step.flow.role).toBe(role)
      expect(shouldRunDynamicDataAsOwner(step)).toBe(expected)
    })
  })

  describe('tiles', () => {
    const tileRows = () => [
      { name: 'Shared tile', value: sharedTileId },
      { name: 'Private tile', value: privateTileId },
    ]

    it.each([
      ['owner', true],
      ['owner', false],
      ['editor', true],
      ['editor', false],
      ['viewer', true],
      ['viewer', false],
    ] as const)('%s runAsOwner=%s', async (role, runAsOwner) => {
      const step = await loadStep(role, tilesStepId)
      const seen: { userId?: string } = {}
      const result = await runStepDynamicData({
        user: users[role],
        step,
        command: command(TILES_KEY, { data: tileRows() }, seen),
        runAsOwner,
      })

      const visible = role === 'viewer' ? [tileRows()[0]] : tileRows()
      expect(result).toEqual({ ok: true, data: visible })
      expect(seen.userId).toBe(runAsOwner ? users.owner.id : users[role].id)
    })
  })

  describe('connection app', () => {
    const fileRows = () => [
      { name: 'Allowed file', value: allowedFile },
      { name: 'Hidden file', value: hiddenFile },
    ]

    it.each([
      ['owner', true],
      ['owner', false],
      ['editor', true],
      ['editor', false],
      ['viewer', true],
      ['viewer', false],
    ] as const)('%s runAsOwner=%s', async (role, runAsOwner) => {
      const step = await loadStep(role, filesStepId)
      const seen: { userId?: string } = {}
      const result = await runStepDynamicData({
        user: users[role],
        step,
        command: command(FILES_KEY, { data: fileRows() }, seen),
        runAsOwner,
      })

      const visible = role === 'owner' ? fileRows() : [fileRows()[0]]
      expect(result).toEqual({ ok: true, data: visible })
      expect(seen.userId).toBe(runAsOwner ? users.owner.id : users[role].id)
    })
  })

  it('overlays parameters before the command runs', async () => {
    const step = await loadStep('owner', tilesStepId)
    const seen: { parameters?: IJSONObject } = {}

    await runStepDynamicData({
      user: users.owner,
      step,
      command: command(TILES_KEY, { data: [] }, seen),
      parameters: { tableId: 'xyz', existingParam: 'overridden' },
      runAsOwner: false,
    })

    expect(seen.parameters?.tableId).toBe('xyz')
    expect(seen.parameters?.existingParam).toBe('overridden')
  })

  it('returns the command error when the result is not filtered', async () => {
    const step = await loadStep('owner', tilesStepId)
    const error = { message: 'upstream failure' }

    const result = await runStepDynamicData({
      user: users.owner,
      step,
      command: command(TILES_KEY, { data: [], error }),
      runAsOwner: false,
    })

    expect(result).toEqual({ ok: false, error })
  })

  it('returns filtered options when the command also reports an error', async () => {
    const step = await loadStep('viewer', filesStepId)
    const error = { message: 'upstream failure' }

    const result = await runStepDynamicData({
      user: users.viewer,
      step,
      command: command(FILES_KEY, {
        data: [
          { name: 'Allowed file', value: allowedFile },
          { name: 'Hidden file', value: hiddenFile },
        ],
        error,
      }),
      runAsOwner: true,
    })

    expect(result).toEqual({
      ok: true,
      data: [{ name: 'Allowed file', value: allowedFile }],
    })
  })

  it('returns an empty filtered list when the command reports an error', async () => {
    const step = await loadStep('viewer', filesStepId)

    const result = await runStepDynamicData({
      user: users.viewer,
      step,
      command: command(FILES_KEY, {
        data: [{ name: 'Hidden file', value: hiddenFile }],
        error: { message: 'upstream failure' },
      }),
      runAsOwner: true,
    })

    expect(result).toEqual({ ok: true, data: [] })
  })

  it('returns every tile for an editor when the command reports an error', async () => {
    const step = await loadStep('editor', tilesStepId)
    const rows = [
      { name: 'Shared tile', value: sharedTileId },
      { name: 'Private tile', value: privateTileId },
    ]

    const result = await runStepDynamicData({
      user: users.editor,
      step,
      command: command(TILES_KEY, {
        data: rows,
        error: { message: 'upstream failure' },
      }),
      runAsOwner: false,
    })

    expect(result).toEqual({ ok: true, data: rows })
  })
})
