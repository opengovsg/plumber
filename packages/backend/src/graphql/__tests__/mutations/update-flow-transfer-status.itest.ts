import { randomUUID } from 'crypto'

import { AES } from 'crypto-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import appConfig from '@/config/app'
import updateFlowTransferStatus from '@/graphql/mutations/update-flow-transfer-status'
import Connection from '@/models/connection'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Flow from '@/models/flow'
import FlowTransfer from '@/models/flow-transfers'
import Step from '@/models/step'
import TableCollaborator from '@/models/table-collaborators'
import User from '@/models/user'
import Context from '@/types/express/context'

import { generateMockFlow, generateMockUser } from './flow.mock'
import { generateMockContext, generateMockTable } from './tiles/table.mock'

describe('updateFlowTransferStatus', () => {
  let context: Context
  let owner: User
  let newOwner: User
  let otherUser: User
  let mockFlow: Flow
  let transfer: FlowTransfer

  beforeEach(async () => {
    context = await generateMockContext()
    owner = context.currentUser
    newOwner = await generateMockUser('editor')
    otherUser = await User.query().insert({
      id: randomUUID(),
      email: 'other@plumber.gov.sg',
    })

    mockFlow = await generateMockFlow(context, randomUUID())

    // minimal one step to allow the approval path later
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

  describe('error cases', () => {
    it('should reject setting status back to pending', async () => {
      await expect(
        updateFlowTransferStatus(
          null,
          { input: { id: transfer.id, status: 'pending' } },
          context,
        ),
      ).rejects.toThrow('No updating of pipe transfer back to pending')
    })

    it('should throw if approving not by new owner', async () => {
      context.currentUser = otherUser
      await expect(
        updateFlowTransferStatus(
          null,
          { input: { id: transfer.id, status: 'approved' } },
          context,
        ),
      ).rejects.toThrow('Pipe transfer request does not belong to new owner')
    })

    it('should throw if rejecting not by new owner', async () => {
      context.currentUser = otherUser
      await expect(
        updateFlowTransferStatus(
          null,
          { input: { id: transfer.id, status: 'rejected' } },
          context,
        ),
      ).rejects.toThrow('Pipe transfer request does not belong to new owner')
    })

    it('should throw if cancelling not by old owner', async () => {
      context.currentUser = otherUser
      await expect(
        updateFlowTransferStatus(
          null,
          { input: { id: transfer.id, status: 'cancelled' } },
          context,
        ),
      ).rejects.toThrow('Pipe transfer request does not belong to old owner')
    })
  })

  describe('status-only updates', () => {
    it('new owner can reject; only status is updated', async () => {
      context.currentUser = newOwner
      const res = await updateFlowTransferStatus(
        null,
        { input: { id: transfer.id, status: 'rejected' } },
        context,
      )
      expect(res.status).toBe('rejected')

      const refreshedFlow = await Flow.query().findById(mockFlow.id)
      expect(refreshedFlow.userId).toBe(owner.id)
    })

    it('old owner can cancel; only status is updated', async () => {
      context.currentUser = owner
      const res = await updateFlowTransferStatus(
        null,
        { input: { id: transfer.id, status: 'cancelled' } },
        context,
      )
      expect(res.status).toBe('cancelled')

      const refreshedFlow = await Flow.query().findById(mockFlow.id)
      expect(refreshedFlow.userId).toBe(owner.id)
    })
  })

  describe('approval path', () => {
    it('transfers ownership and duplicates connections referenced by steps', async () => {
      // Create a connection and link it to an additional step to exercise duplication
      const connectionId = randomUUID()
      await User.query().findById(owner.id) // ensure owner exists
      await Connection.query().insert({
        id: connectionId,
        key: 'slack',
        data: AES.encrypt(
          JSON.stringify({ token: 'secret' }),
          appConfig.encryptionKey,
        ).toString(),
        userId: owner.id,
      })

      await Step.query().insert({
        id: randomUUID(),
        flowId: mockFlow.id,
        key: 'sendMessage2',
        appKey: 'slack',
        type: 'action',
        position: 2,
        parameters: { channel: 'random' },
        status: 'completed',
        connectionId,
      })

      context.currentUser = newOwner
      const result = await updateFlowTransferStatus(
        null,
        { input: { id: transfer.id, status: 'approved' } },
        context,
      )

      expect(result.status).toBe('approved')

      // Flow owner should be updated
      const updatedFlow = await Flow.query().findById(mockFlow.id)
      expect(updatedFlow.userId).toBe(newOwner.id)

      // Steps with previous connectionId should now point to a different id
      const steps = await Step.query().where('flow_id', mockFlow.id)
      const hadOriginal = steps.some((s) => s.connectionId === connectionId)
      expect(hadOriginal).toBe(false)

      // The duplicated connection should exist with userId set to null
      const remainingConnIds = steps
        .map((s) => s.connectionId)
        .filter((id): id is string => Boolean(id))
      if (remainingConnIds.length > 0) {
        const dupConn = await Connection.query().findById(remainingConnIds[0])
        expect(dupConn).toBeTruthy()
        expect(dupConn?.userId).toBeNull()
      }
    })

    it('marks excel steps as incomplete, nullifies connections, and deletes execution steps', async () => {
      const excelConnectionId = randomUUID()
      const excelStepId = randomUUID()
      const executionId = randomUUID()

      // Create an Excel connection
      await Connection.query().insert({
        id: excelConnectionId,
        key: 'm365-excel',
        data: AES.encrypt(
          JSON.stringify({ accessToken: 'test-token' }),
          appConfig.encryptionKey,
        ).toString(),
        userId: owner.id,
      })

      // Create Excel step with connection and completed status

      await Step.query().insert({
        id: excelStepId,
        flowId: mockFlow.id,
        key: 'getTableRows',
        appKey: 'm365-excel',
        type: 'action',
        position: 2,
        parameters: { workbookId: 'test-wb', worksheetId: 'test-ws' },
        status: 'completed',
        connectionId: excelConnectionId,
      })

      // Create execution steps for both the Excel step and the original Slack step

      await Execution.query().insert({
        id: executionId,
        flowId: mockFlow.id,
        status: 'success',
        testRun: false,
      })
      await ExecutionStep.query().insert({
        id: randomUUID(),
        executionId,
        stepId: excelStepId,
        status: 'success',
        dataOut: { rows: [] },
      })

      const slackStepId = (
        await Step.query()
          .findOne({ flow_id: mockFlow.id, app_key: 'slack' })
          .throwIfNotFound()
      ).id

      await ExecutionStep.query().insert({
        id: randomUUID(),
        executionId,
        stepId: slackStepId,
        status: 'success',
        dataOut: { message: 'sent' },
      })

      // Verify initial state: Excel step has connection and is completed
      const initialExcelStep = await Step.query().findById(excelStepId)
      expect(initialExcelStep.connectionId).toBe(excelConnectionId)
      expect(initialExcelStep.status).toBe('completed')

      // Verify execution steps exist
      const initialExecutionSteps = await ExecutionStep.query().whereIn(
        'step_id',
        [excelStepId, slackStepId],
      )
      expect(initialExecutionSteps.length).toBe(2)

      // Approve the transfer
      context.currentUser = newOwner
      const result = await updateFlowTransferStatus(
        null,
        { input: { id: transfer.id, status: 'approved' } },
        context,
      )
      expect(result.status).toBe('approved')

      // Verify Excel step is marked as incomplete and connection is nullified
      const updatedExcelStep = await Step.query().findById(excelStepId)
      expect(updatedExcelStep.status).toBe('incomplete')
      expect(updatedExcelStep.connectionId).toBeNull()

      // Verify all execution steps for Excel step are deleted
      const excelExecutionSteps = await ExecutionStep.query().where(
        'step_id',
        excelStepId,
      )
      expect(excelExecutionSteps.length).toBe(0)

      // Verify the original Excel connection still exists with userId intact
      const originalConnection =
        await Connection.query().findById(excelConnectionId)
      expect(originalConnection).toBeTruthy()
      expect(originalConnection.userId).toBe(owner.id)

      // Verify non-Excel steps remain unaffected (Slack step should still work normally)
      const slackStep = await Step.query().findById(slackStepId)
      expect(slackStep.status).toBe('completed')
    })

    it('verifies old owner has editor access to table before adding new owner as collaborator', async () => {
      const { table } = await generateMockTable({
        userId: owner.id,
        databaseType: 'pg',
      })

      // Create a tiles step that references the table
      const tilesStepId = randomUUID()
      await Step.query().insert({
        id: tilesStepId,
        flowId: mockFlow.id,
        key: 'createTileRow',
        appKey: 'tiles',
        type: 'action',
        position: 2,
        parameters: { rowData: [], tableId: table.id },
        status: 'completed',
      })

      // Spy on hasAccess to verify it's called with correct parameters
      const hasAccessSpy = vi
        .spyOn(TableCollaborator, 'hasAccess')
        .mockResolvedValue(undefined)

      const addCollaboratorSpy = vi
        .spyOn(TableCollaborator, 'upgradeOrInsertCollaborator')
        .mockResolvedValue(undefined)

      // Approve the transfer as new owner
      context.currentUser = newOwner
      const result = await updateFlowTransferStatus(
        null,
        { input: { id: transfer.id, status: 'approved' } },
        context,
      )

      expect(result.status).toBe('approved')

      // Verify hasAccess was called with old owner's ID and 'editor' role
      expect(hasAccessSpy).toHaveBeenCalledWith(
        owner.id, // oldOwnerId
        table.id, // tableId
        'editor', // required role
      )

      // Verify addCollaborator was called to add new owner as editor
      expect(addCollaboratorSpy).toHaveBeenCalledWith({
        userId: newOwner.id,
        tableId: table.id,
        role: 'editor',
        trx: expect.anything(),
      })

      hasAccessSpy.mockRestore()
      addCollaboratorSpy.mockRestore()
    })

    it('throws error when old owner does not have editor access to table', async () => {
      const { table } = await generateMockTable({
        userId: owner.id,
        databaseType: 'pg',
      })

      // Create a tiles step that references the table
      const tilesStepId = randomUUID()
      await Step.query().insert({
        id: tilesStepId,
        flowId: mockFlow.id,
        key: 'createTileRow',
        appKey: 'tiles',
        type: 'action',
        position: 2,
        parameters: { rowData: [], tableId: table.id },
        status: 'completed',
      })

      // Mock hasAccess to throw ForbiddenError (old owner doesn't have access)
      const { ForbiddenError } = await import(
        '@/errors/graphql-errors/index.js'
      )
      const hasAccessSpy = vi
        .spyOn(TableCollaborator, 'hasAccess')
        .mockRejectedValue(
          new ForbiddenError(
            'You do not have sufficient permissions for this tile',
          ),
        )

      // Approve the transfer as new owner
      context.currentUser = newOwner

      // Should throw an error indicating old owner lacks permissions
      await expect(
        updateFlowTransferStatus(
          null,
          { input: { id: transfer.id, status: 'approved' } },
          context,
        ),
      ).rejects.toThrow(
        'Previous owner does not have sufficient permissions to add you as an Editor of the Tile.',
      )

      hasAccessSpy.mockRestore()
    })
  })
})
