import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TEMPLATES } from '@/db/storage'
import {
  generateMockCollaborator,
  generateMockUser,
} from '@/graphql/__tests__/mutations/flow.mock'
import { generateMockContext } from '@/graphql/__tests__/mutations/tiles/table.mock'
import createAiFlowWithSteps from '@/graphql/mutations/ai/create-flow-with-steps'
import createFlow from '@/graphql/mutations/create-flow'
import createStep from '@/graphql/mutations/create-step'
import deleteStep from '@/graphql/mutations/delete-step'
import duplicateBranch from '@/graphql/mutations/duplicate-branch'
import duplicateFlow from '@/graphql/mutations/duplicate-flow'
import updateStepPositions from '@/graphql/mutations/update-step-positions'
import { createFlowFromTemplate } from '@/helpers/flow-templates'
import Flow from '@/models/flow'
import Step from '@/models/step'
import User from '@/models/user'
import { createFlowWithStepsService } from '@/services/mcp/create-flow-with-steps'
import { createStepService } from '@/services/mcp/create-step'
import { updateStepParametersService } from '@/services/mcp/update-step-parameters'
import Context from '@/types/express/context'

// LaunchDarkly is an external service with no test SDK key.
vi.mock('@/helpers/launch-darkly', () => ({
  getAllLdFlags: vi.fn().mockResolvedValue({}),
  getRestrictedAppKeys: vi.fn().mockReturnValue([]),
}))

/**
 * BUSINESS-CRITICAL TESTS. This file pins down the rule:
 *
 *   If a user creates or reorders a step, that user also updated it.
 *
 * STOP and confirm with the user before loosening or deleting an assertion
 * below.
 */

describe('steps.updated_by', () => {
  let context: Context
  let owner: User
  let editor: User
  let flow: Flow
  let trigger: Step

  const flowInput = () => ({
    id: flow.id,
    updatedAt: new Date(flow.updatedAt).getTime().toString(),
  })

  const updatedByOf = async (stepId: string) =>
    (await Step.query().findById(stepId))!.updatedBy

  const updatedByOfFlowSteps = async (flowId: string) =>
    (await Step.query().where('flow_id', flowId)).map((s) => s.updatedBy)

  const triggerStep = { appKey: 'formsg', key: 'newSubmission' }
  const emailStep = {
    appKey: 'postman',
    key: 'sendTransactionalEmail',
    parameters: {},
  }

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
      ...triggerStep,
      type: 'trigger',
      position: 1,
      parameters: {},
      updatedBy: owner.id,
    })

    context.currentUser = editor
  })

  describe('when adding a step', () => {
    it('is set by createStep', async () => {
      const step = await createStep(
        {},
        {
          input: {
            flow: flowInput(),
            previousStep: { id: trigger.id },
            ...emailStep,
          },
        },
        context,
      )

      expect(await updatedByOf(step!.id!)).toBe(editor.id)
    })

    it('is set by duplicateBranch', async () => {
      const result = await duplicateBranch(
        {},
        {
          input: {
            flow: flowInput(),
            previousStep: { id: trigger.id },
            steps: [emailStep],
          },
        },
        context,
      )

      expect(await updatedByOf(result!.steps![0]!.id!)).toBe(editor.id)
    })

    it('is set by MCP create_step', async () => {
      const step = await createStepService({
        user: editor,
        pipeId: flow.id,
        previousStepId: trigger.id,
        appKey: emailStep.appKey,
        key: emailStep.key,
      })

      expect(await updatedByOf(step.id)).toBe(editor.id)
    })

    it('is set on the blank trigger that replaces a deleted trigger', async () => {
      await deleteStep(
        {},
        { input: { ids: [trigger.id], flow: flowInput() } },
        context,
      )

      expect(await updatedByOfFlowSteps(flow.id)).toEqual([editor.id])
    })
  })

  it('is replaced by MCP update_step_parameters', async () => {
    const existing = await flow.$relatedQuery('steps').insertAndFetch({
      ...emailStep,
      type: 'action',
      position: 2,
      updatedBy: owner.id,
    })

    await updateStepParametersService({
      user: editor,
      pipeId: flow.id,
      stepId: existing.id,
      parameters: { subject: 'Hello' },
    })

    expect(await updatedByOf(existing.id)).toBe(editor.id)
  })

  it('is replaced by updateStepPositions on every reordered step', async () => {
    const [first, second] = await flow.$relatedQuery('steps').insertAndFetch(
      [2, 3].map((position) => ({
        ...emailStep,
        type: 'action' as const,
        position,
        updatedBy: owner.id,
      })),
    )

    await updateStepPositions(
      {},
      {
        input: {
          stepPositions: [
            { id: second.id, position: 2, type: 'action' as const },
            { id: first.id, position: 3, type: 'action' as const },
          ],
          flow: flowInput(),
        },
      },
      context,
    )

    expect(await updatedByOf(first.id)).toBe(editor.id)
    expect(await updatedByOf(second.id)).toBe(editor.id)
  })

  describe('when creating a pipe', () => {
    it('is set by createFlow', async () => {
      const newFlow = await createFlow(
        {},
        { input: { flowName: 'New pipe' } },
        context,
      )

      expect(await updatedByOfFlowSteps(newFlow!.id!)).toEqual([editor.id])
    })

    it('is set by duplicateFlow', async () => {
      const copy = await duplicateFlow({}, { input: { id: flow.id } }, context)

      expect(await updatedByOfFlowSteps(copy!.id!)).toEqual([editor.id])
    })

    it('is set by createFlowFromTemplate', async () => {
      const template = TEMPLATES.find((t) =>
        t.steps.every((s) => !s.templateData),
      )!

      const newFlow = await createFlowFromTemplate(template.id, editor)

      const updatedBy = await updatedByOfFlowSteps(newFlow.id)
      expect(updatedBy).toHaveLength(template.steps.length)
      expect(new Set(updatedBy)).toEqual(new Set([editor.id]))
    })

    it('is set by the AI Builder createFlowWithSteps mutation', async () => {
      const newFlow = await createAiFlowWithSteps(
        {},
        {
          input: {
            flowName: 'AI pipe',
            steps: [
              { ...triggerStep, type: 'trigger', position: 1 },
              { ...emailStep, type: 'action', position: 2 },
            ],
            aiBuilderConfig: { traceId: 'trace-1' },
          },
        },
        context,
      )

      expect(await updatedByOfFlowSteps(newFlow!.id!)).toEqual([
        editor.id,
        editor.id,
      ])
    })

    it('is set by MCP create_pipe', async () => {
      const newFlow = await createFlowWithStepsService({
        user: editor,
        name: 'MCP pipe',
        traceId: 'trace-1',
        steps: [
          { ...triggerStep, type: 'trigger' as const, position: 1 },
          { ...emailStep, type: 'action' as const, position: 2 },
        ],
      })

      expect(await updatedByOfFlowSteps(newFlow.id)).toEqual([
        editor.id,
        editor.id,
      ])
    })
  })
})
