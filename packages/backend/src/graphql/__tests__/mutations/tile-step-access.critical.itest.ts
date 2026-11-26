import { beforeEach, describe, expect, it } from 'vitest'

import { ForbiddenError } from '@/errors/graphql-errors'
import createStep from '@/graphql/mutations/create-step'
import duplicateBranch from '@/graphql/mutations/duplicate-branch'
import Flow from '@/models/flow'
import Step from '@/models/step'
import TableCollaborator from '@/models/table-collaborators'
import TableMetadata from '@/models/table-metadata'
import User from '@/models/user'
import { updateStepParametersService } from '@/services/mcp/update-step-parameters'
import Context from '@/types/express/context'

import { generateMockCollaborator, generateMockUser } from './flow.mock'
import { generateMockContext } from './tiles/table.mock'

/**
 * BUSINESS-CRITICAL TESTS. This file pins down the rule:
 *
 *   A user can only point a Tiles step at a Tile they own or edit.
 *
 * Relaxing this rule is a security vulnerability: a pipe editor could read and
 * write rows in any Tile the pipe owner can edit. STOP and confirm with the
 * user before loosening or deleting an assertion below.
 */

describe('Tiles step access', () => {
  let context: Context
  let owner: User
  let editor: User
  let flow: Flow
  let trigger: Step
  let ownerOnlyTile: TableMetadata
  let sharedTile: TableMetadata

  const flowInput = () => ({
    id: flow.id,
    updatedAt: new Date(flow.updatedAt).getTime().toString(),
  })

  const tilesStepInput = (tableId: string) => ({
    appKey: 'tiles',
    key: 'findMultipleRows',
    parameters: { tableId },
  })

  const stepPositions = () =>
    flow.$relatedQuery('steps').select('id', 'position').orderBy('position')

  beforeEach(async () => {
    context = await generateMockContext()
    owner = context.currentUser
    editor = await generateMockUser('editor')

    flow = await owner.$relatedQuery('flows').insertAndFetch({
      name: 'Test Flow',
      updatedBy: owner.id,
    })
    await generateMockCollaborator(flow.id, editor.id, owner.id, 'editor')
    trigger = await flow.$relatedQuery('steps').insertAndFetch({
      key: 'newSubmission',
      appKey: 'formsg',
      type: 'trigger',
      position: 1,
      parameters: {},
    })
    await flow.$relatedQuery('steps').insert({
      key: 'sendTransactionalEmail',
      appKey: 'postman',
      type: 'action',
      position: 2,
      parameters: {},
    })

    ownerOnlyTile = await owner
      .$relatedQuery('tables')
      .insert({ name: 'Owner only', role: 'owner', db: 'pg' })
    sharedTile = await owner
      .$relatedQuery('tables')
      .insert({ name: 'Shared', role: 'owner', db: 'pg' })
    await TableCollaborator.query().insert({
      userId: editor.id,
      tableId: sharedTile.id,
      role: 'editor',
    })

    context.currentUser = editor
  })

  describe('createStep', () => {
    it('rejects a Tile the editor cannot edit and leaves the steps unchanged', async () => {
      const stepsBefore = await stepPositions()

      await expect(
        createStep(
          {},
          {
            input: {
              flow: flowInput(),
              previousStep: { id: trigger.id },
              ...tilesStepInput(ownerOnlyTile.id),
            },
          },
          context,
        ),
      ).rejects.toThrow(ForbiddenError)

      expect(await stepPositions()).toEqual(stepsBefore)
    })

    it('accepts a Tile the editor can edit', async () => {
      const step = await createStep(
        {},
        {
          input: {
            flow: flowInput(),
            previousStep: { id: trigger.id },
            ...tilesStepInput(sharedTile.id),
          },
        },
        context,
      )

      expect(step!.parameters).toEqual({ tableId: sharedTile.id })
    })
  })

  describe('duplicateBranch', () => {
    it('rejects a Tile the editor cannot edit and leaves the steps unchanged', async () => {
      const stepsBefore = await stepPositions()

      await expect(
        duplicateBranch(
          {},
          {
            input: {
              flow: flowInput(),
              previousStep: { id: trigger.id },
              steps: [
                tilesStepInput(sharedTile.id),
                tilesStepInput(ownerOnlyTile.id),
              ],
            },
          },
          context,
        ),
      ).rejects.toThrow(ForbiddenError)

      expect(await stepPositions()).toEqual(stepsBefore)
    })

    it('accepts a Tile the editor can edit', async () => {
      const result = await duplicateBranch(
        {},
        {
          input: {
            flow: flowInput(),
            previousStep: { id: trigger.id },
            steps: [tilesStepInput(sharedTile.id)],
          },
        },
        context,
      )

      expect(result!.steps![0]!.parameters).toEqual({ tableId: sharedTile.id })
    })
  })

  describe('MCP update_step_parameters', () => {
    let tilesStep: Step

    const setTableId = (tableId: string) =>
      updateStepParametersService({
        user: editor,
        pipeId: flow.id,
        stepId: tilesStep.id,
        parameters: { tableId },
      })

    beforeEach(async () => {
      tilesStep = await flow.$relatedQuery('steps').insertAndFetch({
        ...tilesStepInput(sharedTile.id),
        type: 'action',
        position: 3,
      })
    })

    it('rejects a Tile the editor cannot edit and keeps the old Tile', async () => {
      await expect(setTableId(ownerOnlyTile.id)).rejects.toThrow(ForbiddenError)

      expect((await tilesStep.$query()).parameters).toEqual({
        tableId: sharedTile.id,
      })
    })

    it('accepts a Tile the editor can edit', async () => {
      const editorTile = await editor
        .$relatedQuery('tables')
        .insert({ name: 'Editor owned', role: 'owner', db: 'pg' })

      const { step } = await setTableId(editorTile.id)

      expect(step.parameters).toEqual({ tableId: editorTile.id })
    })
  })
})
