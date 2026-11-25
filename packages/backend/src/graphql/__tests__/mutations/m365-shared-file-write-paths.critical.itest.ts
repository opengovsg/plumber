/**
 * Business rule (security finding: "Pipe editor can read and write any
 * workbook in the owner's M365 Plumber folder"):
 * - "When the caller is not the pipe owner, every write path rejects an
 *   m365-excel step whose fileId is not in the pipe's shared-file list for
 *   that connection."
 * - "An editor who saves a fileId outside the list gets an error and the step
 *   is unchanged. The owner's behaviour is unaffected, and so is an editor who
 *   picks an already-shared file."
 * - "It also holds for owner-identity dynamic-data calls made by non-owners."
 */
import { randomUUID } from 'crypto'

import type { IDynamicData } from '@plumber/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import apps from '@/apps'
import createStep from '@/graphql/mutations/create-step'
import duplicateBranch from '@/graphql/mutations/duplicate-branch'
import updateStep from '@/graphql/mutations/update-step'
import getDynamicData from '@/graphql/queries/get-dynamic-data'
import Connection from '@/models/connection'
import Flow from '@/models/flow'
import FlowCollaborator from '@/models/flow-collaborators'
import FlowConnections from '@/models/flow-connections'
import Step from '@/models/step'
import User from '@/models/user'
import { updateStepParametersService } from '@/services/mcp/update-step-parameters'
import Context from '@/types/express/context'

const SHARED_FILE_ID = 'SHARED-FILE'
const UNSHARED_FILE_ID = 'UNSHARED-FILE'
const NOT_SHARED_MESSAGE = 'Selected file is not shared with this pipe'

describe('M365 Excel shared-file list on step write paths', () => {
  let owner: User
  let editor: User
  let flow: Flow
  let connection: Connection
  let excelStep: Step

  const contextFor = (user: User) =>
    ({
      req: null,
      res: null,
      currentUser: user,
      isAdminOperation: false,
    }) as unknown as Context

  const flowInput = async () => {
    const { updatedAt } = await Flow.query().findById(flow.id).throwIfNotFound()
    return { id: flow.id, updatedAt: String(new Date(updatedAt).getTime()) }
  }

  const excelParameters = (fileId: string) => ({
    fileId,
    worksheetId: '{SHEET}',
    cells: [{ address: 'A1' }],
  })

  const sharedFileIds = () =>
    FlowConnections.getSharedParameterValues({
      flowId: flow.id,
      connectionId: connection.id,
      parameterKey: 'fileId',
    })

  const countSteps = async () =>
    (await Step.query().where({ flow_id: flow.id })).length

  const runUpdateStep = async (user: User, fileId: string) =>
    updateStep(
      {},
      {
        input: {
          id: excelStep.id,
          appKey: 'm365-excel',
          key: 'getCellValues',
          connection: { id: connection.id },
          flow: await flowInput(),
          parameters: excelParameters(fileId),
        },
      },
      contextFor(user),
    )

  const runCreateStep = async (user: User, fileId: string) =>
    createStep(
      {},
      {
        input: {
          flow: await flowInput(),
          previousStep: { id: excelStep.id },
          appKey: 'm365-excel',
          key: 'getCellValues',
          connection: { id: connection.id },
          parameters: excelParameters(fileId),
        },
      },
      contextFor(user),
    )

  const runDuplicateBranch = async (user: User, fileId: string) =>
    duplicateBranch(
      {},
      {
        input: {
          flow: await flowInput(),
          previousStep: { id: excelStep.id },
          steps: [
            {
              appKey: 'm365-excel',
              key: 'getCellValues',
              connection: { id: connection.id },
              parameters: excelParameters(fileId),
            },
          ],
        },
      },
      contextFor(user),
    )

  const runMcpUpdate = (user: User, fileId: string) =>
    updateStepParametersService({
      user,
      pipeId: flow.id,
      stepId: excelStep.id,
      parameters: { fileId },
    })

  beforeEach(async () => {
    owner = (await User.query().findOne({ email: 'tester@open.gov.sg' }))!
    editor = await User.query().insert({
      email: `${randomUUID()}@open.gov.sg`,
    })
    flow = await owner.$relatedQuery('flows').insertAndFetch({
      name: 'Shared Excel pipe',
      updatedBy: owner.id,
    })
    await FlowCollaborator.query().insert({
      flowId: flow.id,
      userId: editor.id,
      role: 'editor',
      updatedBy: owner.id,
    })
    connection = await Connection.query().insert({
      key: 'm365-excel',
      formattedData: { tenantKey: 'sg-govt', folderId: 'FOLDER' },
      userId: owner.id,
    })
    await FlowConnections.query().insert({
      flowId: flow.id,
      connectionId: connection.id,
      addedBy: owner.id,
      connectionType: 'connection',
      metadata: { fileId: [SHARED_FILE_ID] },
    })
    ;[, excelStep] = await flow.$relatedQuery('steps').insertAndFetch([
      {
        key: 'newSubmission',
        appKey: 'formsg',
        type: 'trigger',
        position: 1,
      },
      {
        key: 'getCellValues',
        appKey: 'm365-excel',
        type: 'action',
        position: 2,
        connectionId: connection.id,
        parameters: excelParameters(SHARED_FILE_ID),
      },
    ])
  })

  describe('editor', () => {
    it('updateStep rejects an unshared file and leaves the step unchanged', async () => {
      await expect(runUpdateStep(editor, UNSHARED_FILE_ID)).rejects.toThrow(
        NOT_SHARED_MESSAGE,
      )

      const reloaded = await excelStep.$query()
      expect(reloaded.parameters.fileId).toBe(SHARED_FILE_ID)
      expect(await sharedFileIds()).toEqual([SHARED_FILE_ID])
    })

    it('updateStep accepts an already-shared file', async () => {
      await runUpdateStep(editor, SHARED_FILE_ID)

      const reloaded = await excelStep.$query()
      expect(reloaded.parameters.fileId).toBe(SHARED_FILE_ID)
      expect(reloaded.updatedBy).toBe(editor.id)
    })

    it('createStep rejects an unshared file and creates no step', async () => {
      const stepCount = await countSteps()

      await expect(runCreateStep(editor, UNSHARED_FILE_ID)).rejects.toThrow(
        NOT_SHARED_MESSAGE,
      )
      expect(await countSteps()).toBe(stepCount)
    })

    it('createStep accepts an already-shared file', async () => {
      const step = await runCreateStep(editor, SHARED_FILE_ID)

      expect(step?.parameters?.fileId).toBe(SHARED_FILE_ID)
    })

    it('duplicateBranch rejects an unshared file and creates no step', async () => {
      const stepCount = await countSteps()

      await expect(
        runDuplicateBranch(editor, UNSHARED_FILE_ID),
      ).rejects.toThrow(NOT_SHARED_MESSAGE)
      expect(await countSteps()).toBe(stepCount)
    })

    it('duplicateBranch accepts an already-shared file', async () => {
      const result = await runDuplicateBranch(editor, SHARED_FILE_ID)

      expect(result?.steps).toHaveLength(1)
    })

    it('update_step_parameters rejects an unshared file and leaves the step unchanged', async () => {
      await expect(runMcpUpdate(editor, UNSHARED_FILE_ID)).rejects.toThrow(
        NOT_SHARED_MESSAGE,
      )

      const reloaded = await excelStep.$query()
      expect(reloaded.parameters.fileId).toBe(SHARED_FILE_ID)
    })

    it('update_step_parameters accepts an already-shared file', async () => {
      const result = await runMcpUpdate(editor, SHARED_FILE_ID)

      expect(result.step.parameters.fileId).toBe(SHARED_FILE_ID)
    })

    it('cannot add files to the shared-file list', async () => {
      await runUpdateStep(editor, SHARED_FILE_ID)
      await runCreateStep(editor, SHARED_FILE_ID)

      expect(await sharedFileIds()).toEqual([SHARED_FILE_ID])
    })
  })

  describe('owner', () => {
    it.each([
      { path: 'updateStep', run: runUpdateStep },
      { path: 'createStep', run: runCreateStep },
      { path: 'duplicateBranch', run: runDuplicateBranch },
      { path: 'update_step_parameters', run: runMcpUpdate },
    ])(
      '$path saves an unshared file and adds it to the shared-file list',
      async ({ run }) => {
        await run(owner, UNSHARED_FILE_ID)

        expect((await sharedFileIds())?.sort()).toEqual(
          [SHARED_FILE_ID, UNSHARED_FILE_ID].sort(),
        )
        const savedFileIds = (await Step.query().where({ flow_id: flow.id }))
          .map((step) => step.parameters.fileId)
          .filter(Boolean)
        expect(savedFileIds).toContain(UNSHARED_FILE_ID)
      },
    )
  })

  describe('getDynamicData', () => {
    let listWorksheets: IDynamicData

    const runGetDynamicData = (user: User, key: string, fileId: string) =>
      getDynamicData(
        {},
        { stepId: excelStep.id, key, parameters: { fileId } },
        contextFor(user),
      )

    beforeEach(() => {
      listWorksheets = apps['m365-excel'].dynamicData?.find(
        (command) => command.key === 'listWorksheets',
      ) as IDynamicData
      vi.spyOn(listWorksheets, 'run').mockResolvedValue({
        data: [{ name: 'Sheet1', value: '{SHEET}' }],
      })
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('rejects an editor reading an unshared file with the owner identity', async () => {
      await expect(
        runGetDynamicData(editor, 'listWorksheets', UNSHARED_FILE_ID),
      ).rejects.toThrow(NOT_SHARED_MESSAGE)
      expect(listWorksheets.run).not.toHaveBeenCalled()
    })

    it('lets an editor read an already-shared file', async () => {
      await expect(
        runGetDynamicData(editor, 'listWorksheets', SHARED_FILE_ID),
      ).resolves.toEqual([{ name: 'Sheet1', value: '{SHEET}' }])
    })

    it('lets the owner read any file', async () => {
      await expect(
        runGetDynamicData(owner, 'listWorksheets', UNSHARED_FILE_ID),
      ).resolves.toEqual([{ name: 'Sheet1', value: '{SHEET}' }])
    })
  })
})
