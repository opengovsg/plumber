import { IGlobalVariable } from '@plumber/types'

import get from 'lodash.get'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  generateMockFlow,
  generateMockStep,
} from '@/graphql/__tests__/mutations/flow.mock'
import { generateMockContext } from '@/graphql/__tests__/mutations/tiles/table.mock'
import Flow from '@/models/flow'
import Step from '@/models/step'
import Context from '@/types/express/context'

import { ParsedMrfWorkflow } from '../../common/types'
import { createMrfSteps } from '../../triggers/new-submission/create-mrf-steps'

describe('createMrfSteps', () => {
  let context: Context
  let $: IGlobalVariable
  let mockFlow: Flow
  let triggerStep: Step
  const mockFlowId = '00000000-0000-0000-0000-000000000001'

  beforeEach(async () => {
    vi.resetAllMocks()
    context = await generateMockContext()

    // Create a mock flow
    await generateMockFlow(context, mockFlowId)
    mockFlow = (await Flow.query().findById(mockFlowId)) as Flow

    // Create a trigger step (position 1)
    triggerStep = await generateMockStep(
      context,
      'newSubmission',
      'formsg',
      'trigger',
      mockFlowId,
      1,
      {},
    )

    $ = {
      user: context.currentUser,
      flow: mockFlow,
      step: triggerStep,
      app: {
        name: 'formsg',
      },
      setActionItem: vi.fn(),
    } as unknown as IGlobalVariable
  })

  it('should create new action steps with correct positions, parameters, and stepName', async () => {
    const mrfWorkflow: ParsedMrfWorkflow = {
      trigger: {
        defaultStepName: 'Step 1',
        formWorkflowStepId: 'step-001',
        type: 'static',
      },
      actions: [
        {
          defaultStepName: 'Step 2',
          formWorkflowStepId: 'step-002',
          type: 'static',
          fields: ['field1'],
          approvalField: 'field1',
        },
        {
          defaultStepName: 'Step 3',
          formWorkflowStepId: 'step-003',
          type: 'dynamic',
          fields: ['field2'],
          approvalField: 'field2',
        },
      ],
    }

    await createMrfSteps($, mrfWorkflow)

    const allSteps = await Step.query()
      .where('flow_id', mockFlowId)
      .orderBy('position', 'asc')

    expect(allSteps).toHaveLength(3)
    expect(allSteps.map((s) => s.position)).toEqual([1, 2, 3])

    // Verify trigger step updated
    expect(allSteps[0].parameters).toEqual({ mrf: mrfWorkflow.trigger })
    expect(allSteps[0].config?.stepName).toBe('Step 1')

    // Verify action steps
    for (let i = 0; i < mrfWorkflow.actions.length; i++) {
      const step = allSteps[i + 1]
      expect(step.key).toBe('mrfSubmission')
      expect(step.parameters).toEqual({ mrf: mrfWorkflow.actions[i] })
      expect(step.config?.stepName).toBe(mrfWorkflow.actions[i].defaultStepName)
      expect(step.connectionId).toBe(allSteps[0].connectionId)
      expect(step.version).toBe(1)
    }
  })

  it('should update existing steps and maintain their parameters', async () => {
    // Create initial MRF steps
    const initialWorkflow: ParsedMrfWorkflow = {
      trigger: {
        defaultStepName: 'Trigger',
        formWorkflowStepId: 'trigger-001',
        type: 'static',
      },
      actions: [
        {
          defaultStepName: 'Old Action 1',
          formWorkflowStepId: 'action-001',
          type: 'static',
          fields: ['oldField1'],
          approvalField: 'oldField1',
        },
        {
          defaultStepName: 'Old Action 2',
          formWorkflowStepId: 'action-002',
          type: 'dynamic',
          fields: ['oldField2'],
          approvalField: 'oldField2',
        },
      ],
    }

    await createMrfSteps($, initialWorkflow)

    // Update with new parameters
    const updatedWorkflow: ParsedMrfWorkflow = {
      trigger: {
        defaultStepName: 'Updated Trigger',
        formWorkflowStepId: 'trigger-001',
        type: 'conditional',
      },
      actions: [
        {
          defaultStepName: 'Updated Action 1',
          formWorkflowStepId: 'action-001',
          type: 'conditional',
          fields: ['newField1', 'newField2'],
          approvalField: 'newField1',
        },
        {
          defaultStepName: 'Updated Action 2',
          formWorkflowStepId: 'action-002',
          type: 'static',
          fields: ['newField3'],
          approvalField: 'newField3',
        },
      ],
    }

    await createMrfSteps($, updatedWorkflow)

    const allSteps = await Step.query()
      .where('flow_id', mockFlowId)
      .orderBy('position', 'asc')

    // Should still have 3 steps (trigger + 2 actions)
    expect(allSteps).toHaveLength(3)

    // Verify updated parameters
    expect(allSteps[0].parameters.mrf).toEqual(updatedWorkflow.trigger)
    expect(allSteps[1].parameters.mrf).toEqual(updatedWorkflow.actions[0])
    expect(allSteps[2].parameters.mrf).toEqual(updatedWorkflow.actions[1])

    // Verify config.stepName is updated with MRF prefix
    expect(allSteps[0].config?.stepName).toBe('Updated Trigger')
    expect(allSteps[1].config?.stepName).toBe('Updated Action 1')
    expect(allSteps[2].config?.stepName).toBe('Updated Action 2')

    // Verify connectionId propagated from trigger to updated action steps
    expect(allSteps[1].connectionId).toBe(allSteps[0].connectionId)
    expect(allSteps[2].connectionId).toBe(allSteps[0].connectionId)
  })

  it('should handle mixed create, update, and delete operations', async () => {
    // Create initial workflow
    const initialWorkflow: ParsedMrfWorkflow = {
      trigger: {
        defaultStepName: 'Trigger',
        formWorkflowStepId: 'trigger-001',
        type: 'static',
      },
      actions: [
        {
          defaultStepName: 'Action 1',
          formWorkflowStepId: 'action-001',
          type: 'static',
          fields: ['field1'],
        },
        {
          defaultStepName: 'Action 2',
          formWorkflowStepId: 'action-002',
          type: 'dynamic',
          fields: ['field2'],
        },
      ],
    }

    await createMrfSteps($, initialWorkflow)

    // Update: keep action-001, delete action-002, add action-003 and action-004
    const updatedWorkflow: ParsedMrfWorkflow = {
      trigger: {
        defaultStepName: 'Updated Trigger',
        formWorkflowStepId: 'trigger-001',
        type: 'conditional',
      },
      actions: [
        {
          defaultStepName: 'Updated Action 1',
          formWorkflowStepId: 'action-001',
          type: 'conditional',
          fields: ['updatedField1'],
        },
        {
          defaultStepName: 'New Action 3',
          formWorkflowStepId: 'action-003',
          type: 'static',
          fields: ['field3'],
        },
        {
          defaultStepName: 'New Action 4',
          formWorkflowStepId: 'action-004',
          type: 'dynamic',
          fields: ['field4'],
        },
      ],
    }

    await createMrfSteps($, updatedWorkflow)

    const allSteps = await Step.query()
      .where('flow_id', mockFlowId)
      .where('key', 'mrfSubmission')
      .orderBy('position', 'asc')

    expect(allSteps).toHaveLength(3)

    expect(get(allSteps[0].parameters, 'mrf.formWorkflowStepId')).toBe(
      'action-001',
    )
    expect(get(allSteps[0].parameters, 'mrf.fields')).toEqual(['updatedField1'])
    expect(get(allSteps[1].parameters, 'mrf.formWorkflowStepId')).toBe(
      'action-003',
    )
    expect(get(allSteps[2].parameters, 'mrf.formWorkflowStepId')).toBe(
      'action-004',
    )
  })

  it('should preserve non-MRF positions when they are before existing MRF steps', async () => {
    // BEFORE: trigger + ACTION 1 + ACTION 2 + MRF Action 1
    // AFTER: trigger + ACTION 1 + ACTION 2 + MRF Action 1 + MRF Action 2

    // Add some non-MRF steps
    await generateMockStep(
      context,
      'delayFor',
      'delay',
      'action',
      mockFlowId,
      2,
      {},
    )
    await generateMockStep(
      context,
      'sendTransactionalEmail',
      'postman',
      'action',
      mockFlowId,
      3,
      {},
    )
    await generateMockStep(
      context,
      'mrfSubmission',
      'formsg',
      'action',
      mockFlowId,
      4,
      {
        mrf: {
          formWorkflowStepId: 'action-001',
          type: 'static',
          fields: [],
        },
      },
    )

    const mrfWorkflow: ParsedMrfWorkflow = {
      trigger: {
        defaultStepName: 'Trigger',
        formWorkflowStepId: 'trigger-001',
        type: 'static',
      },
      actions: [
        {
          defaultStepName: 'Action 1',
          formWorkflowStepId: 'action-001',
          type: 'static',
          fields: [],
        },
        {
          defaultStepName: 'Action 2',
          formWorkflowStepId: 'action-002',
          type: 'static',
          fields: [],
        },
      ],
    }

    await createMrfSteps($, mrfWorkflow)

    const allSteps = await Step.query()
      .where('flow_id', mockFlowId)
      .orderBy('position', 'asc')

    // Should have trigger + 2 non-MRF + 2 MRF action
    expect(allSteps).toHaveLength(5)

    const mrfSteps = allSteps.filter((step) => step.key === 'mrfSubmission')
    expect(mrfSteps[0].position).toBe(4)
    expect(mrfSteps[1].position).toBe(5)
  })

  it('should insert new steps at correct positions when positions are not sequential', async () => {
    // Create steps with non-sequential positions
    await generateMockStep(
      context,
      'delayFor',
      'delay',
      'action',
      mockFlowId,
      5,
      {},
    )
    await generateMockStep(
      context,
      'sendTransactionalEmail',
      'postman',
      'action',
      mockFlowId,
      10,
      {},
    )

    const mrfWorkflow: ParsedMrfWorkflow = {
      trigger: {
        defaultStepName: 'Trigger',
        formWorkflowStepId: 'trigger-001',
        type: 'static',
      },
      actions: [
        {
          defaultStepName: 'Action 1',
          formWorkflowStepId: 'action-001',
          type: 'static',
          fields: [],
        },
        {
          defaultStepName: 'Action 2',
          formWorkflowStepId: 'action-002',
          type: 'static',
          fields: [],
        },
      ],
    }

    await createMrfSteps($, mrfWorkflow)

    const allSteps = await Step.query()
      .where('flow_id', mockFlowId)
      .orderBy('position', 'asc')

    // MRF actions should be inserted right after trigger
    expect(allSteps[0].position).toBe(1) // Trigger
    expect(allSteps[1].position).toBe(2) // MRF Action 1
    expect(allSteps[2].position).toBe(3) // MRF Action 2
    // Other steps should be shifted down
    expect(allSteps[3].position).toBeGreaterThan(3)
    expect(allSteps[4].position).toBeGreaterThan(allSteps[3].position)
  })

  describe('MRF branch deletion', () => {
    it('should delete all steps within an MRF branch when the MRF action is deleted', async () => {
      // Create initial workflow with 1 MRF action
      const initialWorkflow: ParsedMrfWorkflow = {
        trigger: {
          defaultStepName: 'Trigger',
          formWorkflowStepId: 'trigger-001',
          type: 'static',
        },
        actions: [
          {
            defaultStepName: 'Action 1',
            formWorkflowStepId: 'action-001',
            type: 'static',
            fields: ['approval1'],
            approvalField: 'approval1',
          },
        ],
      }

      await createMrfSteps($, initialWorkflow)

      // Add non-MRF steps after the MRF action (simulating steps in the MRF branch)
      await generateMockStep(
        context,
        'delayFor',
        'delay',
        'action',
        mockFlowId,
        3,
        {},
      )
      await generateMockStep(
        context,
        'sendTransactionalEmail',
        'postman',
        'action',
        mockFlowId,
        4,
        {},
      )

      // Verify we have 4 steps: trigger + MRF action + 2 branch steps
      let allSteps = await Step.query()
        .where('flow_id', mockFlowId)
        .orderBy('position', 'asc')
      expect(allSteps).toHaveLength(4)

      // Now delete the MRF action by updating with empty actions
      const updatedWorkflow: ParsedMrfWorkflow = {
        trigger: {
          defaultStepName: 'Trigger',
          formWorkflowStepId: 'trigger-001',
          type: 'static',
        },
        actions: [],
      }

      await createMrfSteps($, updatedWorkflow)

      // All steps in the MRF branch should be deleted, only trigger remains
      allSteps = await Step.query()
        .where('flow_id', mockFlowId)
        .orderBy('position', 'asc')

      expect(allSteps).toHaveLength(1)
      expect(allSteps[0].type).toBe('trigger')
    })

    it('should delete only the steps within the deleted MRF branch when there are multiple MRF actions', async () => {
      // Create initial workflow with 2 MRF actions
      const initialWorkflow: ParsedMrfWorkflow = {
        trigger: {
          defaultStepName: 'Trigger',
          formWorkflowStepId: 'trigger-001',
          type: 'static',
        },
        actions: [
          {
            defaultStepName: 'Action 1',
            formWorkflowStepId: 'action-001',
            type: 'static',
            fields: ['approval1'],
            approvalField: 'approval1',
          },
          {
            defaultStepName: 'Action 2',
            formWorkflowStepId: 'action-002',
            type: 'static',
            fields: ['approval2'],
            approvalField: 'approval2',
          },
        ],
      }

      await createMrfSteps($, initialWorkflow)

      // Get the MRF step IDs
      const mrfSteps = await Step.query()
        .where('flow_id', mockFlowId)
        .where('key', 'mrfSubmission')
        .orderBy('position', 'asc')

      expect(mrfSteps).toHaveLength(2)

      // Add steps after first MRF action (in first branch) - position 3
      await generateMockStep(
        context,
        'delayFor',
        'delay',
        'action',
        mockFlowId,
        3,
        {},
      )

      // Update second MRF step position to 4
      await Step.query().patchAndFetchById(mrfSteps[1].id, { position: 4 })

      // Add steps after second MRF action (in second branch) - position 5 and 6
      await generateMockStep(
        context,
        'sendTransactionalEmail',
        'postman',
        'action',
        mockFlowId,
        5,
        {},
      )
      await generateMockStep(
        context,
        'sendTransactionalEmail',
        'postman',
        'action',
        mockFlowId,
        6,
        {},
      )

      // Verify we have 6 steps: trigger + 2 MRF actions + 1 step in branch 1 + 2 steps in branch 2
      let allSteps = await Step.query()
        .where('flow_id', mockFlowId)
        .orderBy('position', 'asc')
      expect(allSteps).toHaveLength(6)

      // Delete the first MRF action, keeping the second
      const updatedWorkflow: ParsedMrfWorkflow = {
        trigger: {
          defaultStepName: 'Trigger',
          formWorkflowStepId: 'trigger-001',
          type: 'static',
        },
        actions: [
          {
            defaultStepName: 'Action 2',
            formWorkflowStepId: 'action-002',
            type: 'static',
            fields: ['approval2'],
            approvalField: 'approval2',
          },
        ],
      }

      await createMrfSteps($, updatedWorkflow)

      // Should have: trigger + 1 MRF action + 2 steps from second branch
      // First branch (MRF action 1 + delay step) should be deleted
      allSteps = await Step.query()
        .where('flow_id', mockFlowId)
        .orderBy('position', 'asc')

      expect(allSteps).toHaveLength(4)
      expect(allSteps[0].type).toBe('trigger')
      expect(allSteps[1].key).toBe('mrfSubmission')
      expect(get(allSteps[1].parameters, 'mrf.formWorkflowStepId')).toBe(
        'action-002',
      )
      // The 2 postman steps from the second branch should remain
      expect(allSteps[2].key).toBe('sendTransactionalEmail')
      expect(allSteps[3].key).toBe('sendTransactionalEmail')
    })

    it('should delete middle MRF branch while preserving other branches', async () => {
      // Create initial workflow with 3 MRF actions
      const initialWorkflow: ParsedMrfWorkflow = {
        trigger: {
          defaultStepName: 'Trigger',
          formWorkflowStepId: 'trigger-001',
          type: 'static',
        },
        actions: [
          {
            defaultStepName: 'Action 1',
            formWorkflowStepId: 'action-001',
            type: 'static',
            fields: ['approval1'],
            approvalField: 'approval1',
          },
          {
            defaultStepName: 'Action 2',
            formWorkflowStepId: 'action-002',
            type: 'static',
            fields: ['approval2'],
            approvalField: 'approval2',
          },
          {
            defaultStepName: 'Action 3',
            formWorkflowStepId: 'action-003',
            type: 'static',
            fields: ['approval3'],
            approvalField: 'approval3',
          },
        ],
      }

      await createMrfSteps($, initialWorkflow)

      // Get the MRF step IDs
      const mrfSteps = await Step.query()
        .where('flow_id', mockFlowId)
        .where('key', 'mrfSubmission')
        .orderBy('position', 'asc')

      // Add step after first MRF action (branch 1) - position 3
      await generateMockStep(
        context,
        'delayFor',
        'delay',
        'action',
        mockFlowId,
        3,
        {},
      )

      // Update second MRF step position to 4
      await Step.query().patchAndFetchById(mrfSteps[1].id, { position: 4 })

      // Add steps after second MRF action (branch 2) - position 5
      await generateMockStep(
        context,
        'sendTransactionalEmail',
        'postman',
        'action',
        mockFlowId,
        5,
        {},
      )

      // Update third MRF step position to 6
      await Step.query().patchAndFetchById(mrfSteps[2].id, { position: 6 })

      // Add step after third MRF action (branch 3) - position 7
      await generateMockStep(
        context,
        'delayFor',
        'delay',
        'action',
        mockFlowId,
        7,
        {},
      )

      // Verify we have 7 steps
      let allSteps = await Step.query()
        .where('flow_id', mockFlowId)
        .orderBy('position', 'asc')
      expect(allSteps).toHaveLength(7)

      // Delete the middle MRF action (action-002), keeping first and third
      const updatedWorkflow: ParsedMrfWorkflow = {
        trigger: {
          defaultStepName: 'Trigger',
          formWorkflowStepId: 'trigger-001',
          type: 'static',
        },
        actions: [
          {
            defaultStepName: 'Action 1',
            formWorkflowStepId: 'action-001',
            type: 'static',
            fields: ['approval1'],
            approvalField: 'approval1',
          },
          {
            defaultStepName: 'Action 3',
            formWorkflowStepId: 'action-003',
            type: 'static',
            fields: ['approval3'],
            approvalField: 'approval3',
          },
        ],
      }

      await createMrfSteps($, updatedWorkflow)

      // Should have: trigger + 2 MRF actions + 1 delay (branch 1) + 1 twilio (branch 3)
      // Middle branch (MRF action 2 + postman step) should be deleted
      allSteps = await Step.query()
        .where('flow_id', mockFlowId)
        .orderBy('position', 'asc')

      expect(allSteps).toHaveLength(5)
      expect(allSteps[0].type).toBe('trigger')
      expect(allSteps[1].key).toBe('mrfSubmission')
      expect(get(allSteps[1].parameters, 'mrf.formWorkflowStepId')).toBe(
        'action-001',
      )
      expect(allSteps[2].key).toBe('delayFor') // First branch step preserved
      expect(allSteps[3].key).toBe('mrfSubmission')
      expect(get(allSteps[3].parameters, 'mrf.formWorkflowStepId')).toBe(
        'action-003',
      )
      expect(allSteps[4].key).toBe('delayFor') // Third branch step preserved
    })

    it('should delete reject branch steps when approval field is removed from an existing MRF step', async () => {
      // Create initial workflow with an approval step
      const initialWorkflow: ParsedMrfWorkflow = {
        trigger: {
          defaultStepName: 'Trigger',
          formWorkflowStepId: 'trigger-001',
          type: 'static',
        },
        actions: [
          {
            defaultStepName: 'Action 1',
            formWorkflowStepId: 'action-001',
            type: 'static',
            fields: ['approval1'],
            approvalField: 'approval1',
          },
        ],
      }

      await createMrfSteps($, initialWorkflow)

      // Get the MRF step to add reject branch steps
      const mrfSteps = await Step.query()
        .where('flow_id', mockFlowId)
        .where('key', 'mrfSubmission')
      expect(mrfSteps).toHaveLength(1)
      const mrfStepId = mrfSteps[0].id

      // Add reject branch steps that reference this MRF step
      await generateMockStep(
        context,
        'delayFor',
        'delay',
        'action',
        mockFlowId,
        3,
        {},
        { approval: { branch: 'reject', stepId: mrfStepId } },
      )
      await generateMockStep(
        context,
        'sendTransactionalEmail',
        'postman',
        'action',
        mockFlowId,
        4,
        {},
        { approval: { branch: 'reject', stepId: mrfStepId } },
      )

      // Verify we have 4 steps: trigger + MRF action + 2 reject branch steps
      let allSteps = await Step.query()
        .where('flow_id', mockFlowId)
        .orderBy('position', 'asc')
      expect(allSteps).toHaveLength(4)

      // Update the MRF step to remove the approval field
      const updatedWorkflow: ParsedMrfWorkflow = {
        trigger: {
          defaultStepName: 'Trigger',
          formWorkflowStepId: 'trigger-001',
          type: 'static',
        },
        actions: [
          {
            defaultStepName: 'Action 1',
            formWorkflowStepId: 'action-001',
            type: 'static',
            fields: [],
            // no approvalField
          },
        ],
      }

      await createMrfSteps($, updatedWorkflow)

      // Reject branch steps should be deleted, only trigger + MRF action remain
      allSteps = await Step.query()
        .where('flow_id', mockFlowId)
        .orderBy('position', 'asc')

      expect(allSteps).toHaveLength(2)
      expect(allSteps[0].type).toBe('trigger')
      expect(allSteps[1].key).toBe('mrfSubmission')
    })

    it('should re-point reject branch steps to new last MRF step when it has approvalField', async () => {
      // Create initial workflow with an approval step
      const initialWorkflow: ParsedMrfWorkflow = {
        trigger: {
          defaultStepName: 'Trigger',
          formWorkflowStepId: 'trigger-001',
          type: 'static',
        },
        actions: [
          {
            defaultStepName: 'Action 1',
            formWorkflowStepId: 'action-001',
            type: 'static',
            fields: ['approval1'],
            approvalField: 'approval1',
          },
        ],
      }

      await createMrfSteps($, initialWorkflow)

      // Get the MRF step
      const mrfSteps = await Step.query()
        .where('flow_id', mockFlowId)
        .where('key', 'mrfSubmission')
      const originalMrfStepId = mrfSteps[0].id

      // Add reject branch steps referencing the original MRF step
      await generateMockStep(
        context,
        'delayFor',
        'delay',
        'action',
        mockFlowId,
        3,
        {},
        { approval: { branch: 'reject', stepId: originalMrfStepId } },
      )

      // Add a new MRF action with approvalField
      const updatedWorkflow: ParsedMrfWorkflow = {
        trigger: {
          defaultStepName: 'Trigger',
          formWorkflowStepId: 'trigger-001',
          type: 'static',
        },
        actions: [
          {
            defaultStepName: 'Action 1',
            formWorkflowStepId: 'action-001',
            type: 'static',
            fields: ['approval1'],
            approvalField: 'approval1',
          },
          {
            defaultStepName: 'Action 2',
            formWorkflowStepId: 'action-002',
            type: 'static',
            fields: ['approval2'],
            approvalField: 'approval2',
          },
        ],
      }

      await createMrfSteps($, updatedWorkflow)

      // Get the new last MRF step
      const allMrfSteps = await Step.query()
        .where('flow_id', mockFlowId)
        .where('key', 'mrfSubmission')
        .orderBy('position', 'asc')
      expect(allMrfSteps).toHaveLength(2)
      const newLastMrfStepId = allMrfSteps[1].id

      // The reject branch step should now point to the new last MRF step
      const rejectBranchSteps = await Step.query()
        .where('flow_id', mockFlowId)
        .whereNot('key', 'mrfSubmission')
        .where('type', 'action')

      expect(rejectBranchSteps).toHaveLength(1)
      expect(rejectBranchSteps[0].config?.approval?.branch).toBe('reject')
      expect(rejectBranchSteps[0].config?.approval?.stepId).toBe(
        newLastMrfStepId,
      )
    })

    it('should delete reject branch steps when new last MRF step lacks approvalField', async () => {
      // Create initial workflow with an approval step
      const initialWorkflow: ParsedMrfWorkflow = {
        trigger: {
          defaultStepName: 'Trigger',
          formWorkflowStepId: 'trigger-001',
          type: 'static',
        },
        actions: [
          {
            defaultStepName: 'Action 1',
            formWorkflowStepId: 'action-001',
            type: 'static',
            fields: ['approval1'],
            approvalField: 'approval1',
          },
        ],
      }

      await createMrfSteps($, initialWorkflow)

      // Get the MRF step
      const mrfSteps = await Step.query()
        .where('flow_id', mockFlowId)
        .where('key', 'mrfSubmission')
      const originalMrfStepId = mrfSteps[0].id

      // Add reject branch steps referencing the original MRF step
      await generateMockStep(
        context,
        'delayFor',
        'delay',
        'action',
        mockFlowId,
        3,
        {},
        { approval: { branch: 'reject', stepId: originalMrfStepId } },
      )
      await generateMockStep(
        context,
        'sendTransactionalEmail',
        'postman',
        'action',
        mockFlowId,
        4,
        {},
        { approval: { branch: 'reject', stepId: originalMrfStepId } },
      )

      // Verify we have 4 steps
      let allSteps = await Step.query()
        .where('flow_id', mockFlowId)
        .orderBy('position', 'asc')
      expect(allSteps).toHaveLength(4)

      // Add a new MRF action WITHOUT approvalField
      const updatedWorkflow: ParsedMrfWorkflow = {
        trigger: {
          defaultStepName: 'Trigger',
          formWorkflowStepId: 'trigger-001',
          type: 'static',
        },
        actions: [
          {
            defaultStepName: 'Action 1',
            formWorkflowStepId: 'action-001',
            type: 'static',
            fields: ['approval1'],
            approvalField: 'approval1',
          },
          {
            defaultStepName: 'Action 2',
            formWorkflowStepId: 'action-002',
            type: 'static',
            fields: [],
            // no approvalField
          },
        ],
      }

      await createMrfSteps($, updatedWorkflow)

      // Reject branch steps should be deleted
      allSteps = await Step.query()
        .where('flow_id', mockFlowId)
        .orderBy('position', 'asc')

      // Should have: trigger + 2 MRF actions (reject branch steps deleted)
      expect(allSteps).toHaveLength(3)
      expect(allSteps[0].type).toBe('trigger')
      expect(allSteps[1].key).toBe('mrfSubmission')
      expect(allSteps[2].key).toBe('mrfSubmission')

      // Verify no reject branch steps remain
      const rejectSteps = allSteps.filter(
        (step) => step.config?.approval?.branch === 'reject',
      )
      expect(rejectSteps).toHaveLength(0)
    })
  })

  describe('if-then jump targets', () => {
    function jumpTarget(step: Step): unknown {
      return (step.parameters as Record<string, unknown>)?.stepIdToJumpTo
    }

    async function assertNoDanglingJumpTargets(flowId: string): Promise<void> {
      const steps = await Step.query().where('flow_id', flowId)
      const ids = new Set(steps.map((step) => step.id))
      for (const step of steps) {
        const target = jumpTarget(step)
        if (typeof target === 'string') {
          expect(ids.has(target)).toBe(true)
        }
      }
    }

    /**
     * Appends, after the existing steps, an if-then block chained into a second
     * if-then block plus a single step after it, wiring the chain of steps to
     * jump to (target-first so the forward-pointing ids exist):
     *
     *   ifThenA   (startPosition)      stepIdToJumpTo -> ifThenB
     *   actionA   (startPosition + 1)
     *   ifThenB   (startPosition + 2)  stepIdToJumpTo -> afterStep
     *   actionB   (startPosition + 3)
     *   afterStep (startPosition + 4)
     */
    async function appendIfThenBlock(startPosition: number) {
      const afterStep = await generateMockStep(
        context,
        'sendTransactionalEmail',
        'postman',
        'action',
        mockFlowId,
        startPosition + 4,
      )
      const ifThenB = await generateMockStep(
        context,
        'ifThen',
        'toolbox',
        'action',
        mockFlowId,
        startPosition + 2,
        { depth: 0, branchName: 'B', stepIdToJumpTo: afterStep.id },
      )
      const ifThenA = await generateMockStep(
        context,
        'ifThen',
        'toolbox',
        'action',
        mockFlowId,
        startPosition,
        { depth: 0, branchName: 'A', stepIdToJumpTo: ifThenB.id },
      )
      await generateMockStep(
        context,
        'sendTransactionalEmail',
        'postman',
        'action',
        mockFlowId,
        startPosition + 1,
      )
      await generateMockStep(
        context,
        'sendTransactionalEmail',
        'postman',
        'action',
        mockFlowId,
        startPosition + 3,
      )
      return { afterStep, ifThenB, ifThenA }
    }

    it('keeps stepIdToJumpTo pointers valid when a new MRF step shifts positions', async () => {
      await createMrfSteps($, {
        trigger: {
          defaultStepName: 'Trigger',
          formWorkflowStepId: 'trigger-001',
          type: 'static',
        },
        actions: [
          {
            defaultStepName: 'Action 1',
            formWorkflowStepId: 'action-001',
            type: 'static',
            fields: [],
          },
        ],
      })
      // trigger(1) + MRF-001(2); block occupies positions 3..7.
      const { afterStep, ifThenB, ifThenA } = await appendIfThenBlock(3)

      // Add a second MRF step: inserted at the front, shifting the block down.
      await createMrfSteps($, {
        trigger: {
          defaultStepName: 'Trigger',
          formWorkflowStepId: 'trigger-001',
          type: 'static',
        },
        actions: [
          {
            defaultStepName: 'Action 1',
            formWorkflowStepId: 'action-001',
            type: 'static',
            fields: [],
          },
          {
            defaultStepName: 'Action 2',
            formWorkflowStepId: 'action-002',
            type: 'static',
            fields: [],
          },
        ],
      })

      const reloadedA = await Step.query().findById(ifThenA.id)
      const reloadedB = await Step.query().findById(ifThenB.id)

      // ids are stable across the position shift, so the pointers still resolve.
      expect(jumpTarget(reloadedA)).toBe(ifThenB.id)
      expect(jumpTarget(reloadedB)).toBe(afterStep.id)
      expect(reloadedA.position).toBeGreaterThan(3)
      await assertNoDanglingJumpTargets(mockFlowId)
    })

    it('removes an if-then block and its after-steps together on a trailing MRF delete', async () => {
      await createMrfSteps($, {
        trigger: {
          defaultStepName: 'Trigger',
          formWorkflowStepId: 'trigger-001',
          type: 'static',
        },
        actions: [
          {
            defaultStepName: 'Action 1',
            formWorkflowStepId: 'action-001',
            type: 'static',
            fields: [],
          },
          {
            defaultStepName: 'Action 2',
            formWorkflowStepId: 'action-002',
            type: 'static',
            fields: [],
          },
        ],
      })
      // trigger(1) + MRF-001(2) + MRF-002(3); block occupies positions 4..8.
      await appendIfThenBlock(4)

      // Delete the trailing MRF step (action-002); its whole branch — the block
      // and its after-steps — is removed together.
      await createMrfSteps($, {
        trigger: {
          defaultStepName: 'Trigger',
          formWorkflowStepId: 'trigger-001',
          type: 'static',
        },
        actions: [
          {
            defaultStepName: 'Action 1',
            formWorkflowStepId: 'action-001',
            type: 'static',
            fields: [],
          },
        ],
      })

      const remaining = await Step.query()
        .where('flow_id', mockFlowId)
        .orderBy('position', 'asc')

      // Only trigger + the surviving MRF-001 remain; no if-then steps linger.
      expect(remaining.map((step) => step.key)).toEqual([
        'newSubmission',
        'mrfSubmission',
      ])
      await assertNoDanglingJumpTargets(mockFlowId)
    })
  })
})
