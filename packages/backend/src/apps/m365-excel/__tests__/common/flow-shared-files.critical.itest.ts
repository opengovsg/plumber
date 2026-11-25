/**
 * Business rule (security finding: "Pipe editor can read and write any
 * workbook in the owner's M365 Plumber folder"):
 * - "A step on a pipe with collaborators cannot open a workbook outside the
 *   pipe's shared-file list unless the owner put it there."
 * - "This holds at execution time however the parameter was stored."
 * - "A step row carrying an unshared fileId fails with a configuration error
 *   in both executeStep and a worker run, and no cell data is returned."
 */
import { randomUUID } from 'crypto'

import type { IGlobalVariable } from '@plumber/types'
import { beforeEach, describe, expect, it } from 'vitest'

import StepError from '@/errors/step'
import Connection from '@/models/connection'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Flow from '@/models/flow'
import FlowCollaborator from '@/models/flow-collaborators'
import FlowConnections from '@/models/flow-connections'
import User from '@/models/user'
import { processAction } from '@/services/action'

import { validateFileSharedWithFlow } from '../../common/flow-shared-files'

const SHARED_FILE_ID = 'SHARED-FILE'
const UNSHARED_FILE_ID = 'UNSHARED-FILE'

describe('validateFileSharedWithFlow', () => {
  let owner: User
  let editor: User
  let flow: Flow
  let connection: Connection

  const makeGlobalVariable = (connectionId = connection.id) =>
    ({
      flow: { id: flow.id },
      auth: { connectionId },
    }) as unknown as IGlobalVariable

  const shareConnection = (fileIds: string[], connectionId = connection.id) =>
    FlowConnections.query().insert({
      flowId: flow.id,
      connectionId,
      addedBy: owner.id,
      connectionType: 'connection',
      metadata: { fileId: fileIds },
    })

  const addEditor = () =>
    FlowCollaborator.query().insert({
      flowId: flow.id,
      userId: editor.id,
      role: 'editor',
      updatedBy: owner.id,
    })

  const expectNotShared = async (promise: Promise<void>) => {
    const error = await promise.catch((err: unknown) => err)
    expect(error).toBeInstanceOf(StepError)
    expect(error).toMatchObject({ kind: 'config' })
  }

  beforeEach(async () => {
    owner = (await User.query().findOne({ email: 'tester@open.gov.sg' }))!
    editor = await User.query().insert({
      email: `${randomUUID()}@open.gov.sg`,
    })
    flow = await owner.$relatedQuery('flows').insertAndFetch({
      name: 'Shared Excel pipe',
    })
    connection = await Connection.query().insert({
      key: 'm365-excel',
      formattedData: { tenantKey: 'sg-govt', folderId: 'FOLDER' },
      userId: owner.id,
    })
  })

  it('allows a file in the shared-file list of a pipe with collaborators', async () => {
    await addEditor()
    await shareConnection([SHARED_FILE_ID])

    await expect(
      validateFileSharedWithFlow(makeGlobalVariable(), SHARED_FILE_ID),
    ).resolves.toBeUndefined()
  })

  it('rejects a file outside the shared-file list of a pipe with collaborators', async () => {
    await addEditor()
    await shareConnection([SHARED_FILE_ID])

    await expectNotShared(
      validateFileSharedWithFlow(makeGlobalVariable(), UNSHARED_FILE_ID),
    )
  })

  it('rejects any file when the pipe has collaborators but the connection is not shared', async () => {
    await addEditor()

    await expectNotShared(
      validateFileSharedWithFlow(makeGlobalVariable(), SHARED_FILE_ID),
    )
  })

  it('ignores files shared through another connection', async () => {
    await addEditor()
    const otherConnection = await Connection.query().insert({
      key: 'm365-excel',
      formattedData: { tenantKey: 'sg-govt', folderId: 'OTHER' },
      userId: owner.id,
    })
    await shareConnection([], connection.id)
    await shareConnection([UNSHARED_FILE_ID], otherConnection.id)

    await expectNotShared(
      validateFileSharedWithFlow(makeGlobalVariable(), UNSHARED_FILE_ID),
    )
  })

  it('keeps rejecting unshared files after the last collaborator is removed', async () => {
    await addEditor()
    await shareConnection([SHARED_FILE_ID])
    await FlowCollaborator.query().delete().where({ flow_id: flow.id })

    await expectNotShared(
      validateFileSharedWithFlow(makeGlobalVariable(), UNSHARED_FILE_ID),
    )
  })

  it('allows any file on a pipe that was never shared', async () => {
    await expect(
      validateFileSharedWithFlow(makeGlobalVariable(), UNSHARED_FILE_ID),
    ).resolves.toBeUndefined()
  })

  describe.each([
    { runType: 'test run (executeStep)', testRun: true },
    { runType: 'published run (worker)', testRun: false },
  ])('processAction in a $runType', ({ testRun }) => {
    const runGetCellValues = async (
      getFileId: (triggerId: string) => string,
      priorDataOut = {},
    ) => {
      const triggerId = randomUUID()
      const [trigger, action] = await flow
        .$relatedQuery('steps')
        .insertAndFetch([
          {
            id: triggerId,
            key: 'newSubmission',
            appKey: 'formsg',
            type: 'trigger',
            position: 1,
            status: 'completed',
          },
          {
            key: 'getCellValues',
            appKey: 'm365-excel',
            type: 'action',
            position: 2,
            status: 'completed',
            connectionId: connection.id,
            parameters: {
              fileId: getFileId(triggerId),
              worksheetId: '{SHEET}',
              cells: [{ address: 'A1' }],
            },
          },
        ])
      const execution = await Execution.query().insertAndFetch({
        flowId: flow.id,
        testRun,
      })
      await ExecutionStep.query().insert({
        executionId: execution.id,
        stepId: trigger.id,
        status: 'success',
        dataOut: priorDataOut,
      })

      await processAction({
        flowId: flow.id,
        stepId: action.id,
        executionId: execution.id,
        testRun,
      })

      return ExecutionStep.query()
        .findOne({ execution_id: execution.id, step_id: action.id })
        .throwIfNotFound()
    }

    beforeEach(async () => {
      await addEditor()
      await shareConnection([SHARED_FILE_ID])
    })

    it('fails a stored unshared fileId with a config error and no cell data', async () => {
      const executionStep = await runGetCellValues(() => UNSHARED_FILE_ID)

      expect(executionStep.status).toBe('failure')
      expect(executionStep.dataOut).toBeNull()
      expect(executionStep.errorDetails).toMatchObject({
        name: 'This file is not shared with this pipe.',
        kind: 'config',
      })
    })

    it('fails an unshared fileId resolved from a step variable', async () => {
      const executionStep = await runGetCellValues(
        (triggerId) => `{{step.${triggerId}.fileId}}`,
        { fileId: UNSHARED_FILE_ID },
      )

      expect(executionStep.dataIn).toMatchObject({ fileId: UNSHARED_FILE_ID })
      expect(executionStep.status).toBe('failure')
      expect(executionStep.dataOut).toBeNull()
      expect(executionStep.errorDetails).toMatchObject({ kind: 'config' })
    })
  })
})
