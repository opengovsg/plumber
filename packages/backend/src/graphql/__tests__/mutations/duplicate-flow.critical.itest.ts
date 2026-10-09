/**
 * Business rules (verbatim from the product owner):
 * - "enable pipe duplication for editors and viewers without duplicating the
 *   connections in the Pipe, but still retain custom step names, variables
 *   and step parameters that are not 'sensitive'."
 * - "we don't duplicate any connections"
 * - "drop the config on Editor/Viewer duplicate"
 */
import { IFlowCollabRole } from '@plumber/types'

import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it } from 'vitest'

import duplicateFlow from '@/graphql/mutations/duplicate-flow'
import Connection from '@/models/connection'
import Flow from '@/models/flow'
import FlowCollaborator from '@/models/flow-collaborators'
import Step from '@/models/step'
import User from '@/models/user'
import Context from '@/types/express/context'

describe.each<IFlowCollabRole>(['editor', 'viewer'])(
  'duplicateFlow by a %s',
  (role) => {
    let owner: User
    let collaborator: User
    let flow: Flow
    let steps: Step[]

    const contextFor = (user: User) =>
      ({
        req: null,
        res: null,
        currentUser: user,
        isAdminOperation: false,
      } as unknown as Context)

    beforeEach(async () => {
      await FlowCollaborator.query().delete()
      await Step.query().delete()
      await Flow.query().delete()

      owner = await User.query().findOne({ email: 'tester@open.gov.sg' })
      collaborator = await User.query().insert({
        email: `${randomUUID()}@open.gov.sg`,
      })
      const collaboratorConnection = await Connection.query().insert({
        key: 'slack',
        data: 'collaborator-secret',
        userId: collaborator.id,
      })
      const ownerConnection = await Connection.query().insert({
        key: 'formsg',
        data: 'owner-secret',
        userId: owner.id,
      })

      flow = await owner.$relatedQuery('flows').insertAndFetch({
        name: 'Source Flow',
        config: {
          errorConfig: {
            notificationFrequency: 'always',
            notificationRecipients: ['editor'],
          },
          rejectIfOverMaxQps: true,
        },
      })
      await FlowCollaborator.query().insert({
        flowId: flow.id,
        userId: collaborator.id,
        role,
        updatedBy: owner.id,
      })

      const trigger = await flow.$relatedQuery('steps').insertAndFetch({
        key: 'newSubmission',
        appKey: 'formsg',
        type: 'trigger',
        position: 1,
        connectionId: ownerConnection.id,
        parameters: { nricFilter: 'mask' },
        config: { stepName: 'Form trigger' },
      })
      const triggerVariable = `{{step.${trigger.id}.fields.abc.answer}}`
      const actions = (await flow.$relatedQuery('steps').insertAndFetch([
        {
          key: 'sendMessageToChannel',
          appKey: 'slack',
          type: 'action',
          position: 2,
          connectionId: collaboratorConnection.id,
          parameters: { channel: 'C123', message: `Hi ${triggerVariable}` },
          config: { stepName: 'Notify team' },
        },
        {
          key: 'createTileRow',
          appKey: 'tiles',
          type: 'action',
          position: 3,
          parameters: {
            tableId: randomUUID(),
            rowData: [{ columnId: 'col-1', cellValue: triggerVariable }],
          },
        },
        {
          key: 'createTableRow',
          appKey: 'm365-excel',
          type: 'action',
          position: 4,
          connectionId: ownerConnection.id,
          parameters: {
            fileId: 'file-1',
            worksheetId: 'sheet-1',
            tableId: 'table-1',
            columnValues: [{ columnName: 'Name', value: triggerVariable }],
          },
        },
        {
          key: 'newInstantWorkflow',
          appKey: 'gathersg',
          type: 'trigger',
          position: 5,
          parameters: { encryptionKey: 'gather-secret' },
        },
        {
          key: 'httpRequest',
          appKey: 'custom-api',
          type: 'action',
          position: 6,
          parameters: {
            url: 'https://example.com',
            customHeaders: [
              { key: 'Authorization', value: 'Bearer abc' },
              { key: 'Content-Type', value: 'application/json' },
            ],
          },
        },
      ])) as unknown as Step[]
      steps = [trigger, ...actions]
    })

    const duplicate = async () => {
      const duplicated = await duplicateFlow(
        null,
        { input: { id: flow.id } },
        contextFor(collaborator),
      )
      const copy = await Flow.query().findById(duplicated.id)
      const copiedSteps = await copy
        .$relatedQuery('steps')
        .orderBy('position', 'asc')
      return { copy, copiedSteps }
    }

    it('gives the copy to the collaborator', async () => {
      const { copy } = await duplicate()

      expect(copy.userId).toBe(collaborator.id)
      expect(copy.name).toBe('[COPY] Source Flow')
    })

    it('does not copy any connection, including the collaborator own', async () => {
      const { copiedSteps } = await duplicate()

      expect(copiedSteps).toHaveLength(steps.length)
      for (const step of copiedSteps) {
        expect(step.connectionId).toBeNull()
      }
    })

    it('does not copy the pipe config', async () => {
      const { copy } = await duplicate()

      expect(copy.config ?? {}).toEqual({})
    })

    it('does not copy sensitive step parameters', async () => {
      const { copiedSteps } = await duplicate()
      const [, , tiles, excel, gather, customApi] = copiedSteps

      expect(tiles.parameters.tableId).toBeUndefined()
      expect(tiles.parameters.rowData).toEqual([
        expect.objectContaining({ columnId: '' }),
      ])
      expect(excel.parameters.fileId).toBeUndefined()
      expect(excel.parameters.worksheetId).toBeUndefined()
      expect(excel.parameters.tableId).toBeUndefined()
      expect(gather.parameters.encryptionKey).toBeUndefined()
      expect(customApi.parameters.customHeaders).toEqual([
        { key: 'Content-Type', value: 'application/json' },
      ])
    })

    it('keeps step names, remapped variables and other parameters', async () => {
      const { copiedSteps } = await duplicate()
      const [trigger, slack, tiles, excel, , customApi] = copiedSteps
      const newVariable = `{{step.${trigger.id}.fields.abc.answer}}`

      expect(trigger.config.stepName).toBe('Form trigger')
      expect(trigger.parameters).toEqual({ nricFilter: 'mask' })
      expect(slack.config.stepName).toBe('Notify team')
      expect(slack.parameters).toEqual({
        channel: 'C123',
        message: `Hi ${newVariable}`,
      })
      expect(tiles.parameters.rowData).toEqual([
        { columnId: '', cellValue: newVariable },
      ])
      expect(excel.parameters.columnValues).toEqual([
        { columnName: 'Name', value: newVariable },
      ])
      expect(customApi.parameters.url).toBe('https://example.com')
    })

    it('leaves the original pipe untouched apart from the duplicate count', async () => {
      await duplicate()

      const original = await Flow.query().findById(flow.id)
      const originalSteps = await original
        .$relatedQuery('steps')
        .orderBy('position', 'asc')
      expect(original.config.duplicateCount).toBe(1)
      expect(original.config.errorConfig?.notificationFrequency).toBe('always')
      expect(originalSteps.map((step) => step.connectionId)).toEqual(
        steps.map((step) => step.connectionId),
      )
      expect(originalSteps[3].parameters.fileId).toBe('file-1')
    })
  },
)
