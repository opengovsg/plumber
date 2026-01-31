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

  it('should update trigger step parameters', async () => {
    const mrfWorkflow: ParsedMrfWorkflow = {
      trigger: {
        defaultStepName: 'Trigger Step',
        formWorkflowStepId: 'trigger-001',
        type: 'static',
        fields: ['approver1@open.gov.sg', 'approver2@open.gov.sg'],
      },
      actions: [],
    }

    await createMrfSteps($, mrfWorkflow)

    const updatedTrigger = await Step.query().findById(triggerStep.id)
    expect(updatedTrigger?.parameters).toEqual({
      mrf: mrfWorkflow.trigger,
    })
  })

  it('should create new action steps with correct positions', async () => {
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
          approvalField: 'approval1',
        },
        {
          defaultStepName: 'Step 3',
          formWorkflowStepId: 'step-003',
          type: 'dynamic',
          fields: ['field2'],
          approvalField: 'approval2',
        },
        {
          defaultStepName: 'Step 4',
          formWorkflowStepId: 'step-004',
          type: 'conditional',
          fields: ['field3'],
          approvalField: 'approval3',
        },
      ],
    }

    await createMrfSteps($, mrfWorkflow)

    const allSteps = await Step.query()
      .where('flow_id', mockFlowId)
      .orderBy('position', 'asc')

    // Should have trigger + 3 action steps
    expect(allSteps).toHaveLength(4)

    // Verify positions are sequential
    expect(allSteps[0].position).toBe(1) // Trigger
    expect(allSteps[1].position).toBe(2) // Action 1
    expect(allSteps[2].position).toBe(3) // Action 2
    expect(allSteps[3].position).toBe(4) // Action 3

    // Verify action steps have correct parameters
    expect(allSteps[1].parameters).toEqual({ mrf: mrfWorkflow.actions[0] })
    expect(allSteps[2].parameters).toEqual({ mrf: mrfWorkflow.actions[1] })
    expect(allSteps[3].parameters).toEqual({ mrf: mrfWorkflow.actions[2] })

    // Verify all are MRF steps
    expect(allSteps[1].key).toBe('mrfSubmission')
    expect(allSteps[2].key).toBe('mrfSubmission')
    expect(allSteps[3].key).toBe('mrfSubmission')
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
          approvalField: 'oldApproval1',
        },
        {
          defaultStepName: 'Old Action 2',
          formWorkflowStepId: 'action-002',
          type: 'dynamic',
          fields: ['oldField2'],
          approvalField: 'oldApproval2',
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
          approvalField: 'newApproval1',
        },
        {
          defaultStepName: 'Updated Action 2',
          formWorkflowStepId: 'action-002',
          type: 'static',
          fields: ['newField3'],
          approvalField: 'newApproval2',
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
  })

  it('should delete steps that no longer exist in actions', async () => {
    // Create initial workflow with 3 actions
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
          fields: [],
        },
        {
          defaultStepName: 'Action 2',
          formWorkflowStepId: 'action-002',
          type: 'static',
          fields: [],
        },
        {
          defaultStepName: 'Action 3',
          formWorkflowStepId: 'action-003',
          type: 'static',
          fields: [],
        },
      ],
    }

    await createMrfSteps($, initialWorkflow)

    // Update workflow with only 1 action
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
        },
      ],
    }

    await createMrfSteps($, updatedWorkflow)

    const allSteps = await Step.query()
      .where('flow_id', mockFlowId)
      .orderBy('position', 'asc')

    // Should only have trigger + 1 action
    expect(allSteps).toHaveLength(2)
    const formWorkflowStepId = get(
      allSteps[1].parameters,
      'mrf.formWorkflowStepId',
    )
    expect(formWorkflowStepId).toBe('action-001')
  })

  it('should shift positions up when deleting steps', async () => {
    // Create initial workflow with 3 actions
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
          fields: [],
        },
        {
          defaultStepName: 'Action 2',
          formWorkflowStepId: 'action-002',
          type: 'static',
          fields: [],
        },
        {
          defaultStepName: 'Action 3',
          formWorkflowStepId: 'action-003',
          type: 'static',
          fields: [],
        },
      ],
    }

    await createMrfSteps($, initialWorkflow)

    // Add a non-MRF step after the MRF steps
    await generateMockStep(
      context,
      'delayFor',
      'delay',
      'action',
      mockFlowId,
      5,
      {},
    )

    // Remove middle actions (action-001 and action-002)
    const updatedWorkflow: ParsedMrfWorkflow = {
      trigger: {
        defaultStepName: 'Trigger',
        formWorkflowStepId: 'trigger-001',
        type: 'static',
      },
      actions: [
        {
          defaultStepName: 'Action 3',
          formWorkflowStepId: 'action-003',
          type: 'static',
          fields: [],
        },
      ],
    }

    await createMrfSteps($, updatedWorkflow)

    const allSteps = await Step.query()
      .where('flow_id', mockFlowId)
      .orderBy('position', 'asc')

    // Verify positions are sequential with no gaps
    expect(allSteps).toHaveLength(3) // trigger + 1 MRF actions + 1 delay
    expect(allSteps.map((step) => step.position)).toEqual([1, 2, 3])
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

  it('should handle empty actions array', async () => {
    // Create initial workflow with actions
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
          fields: [],
        },
      ],
    }

    await createMrfSteps($, initialWorkflow)

    // Update with empty actions
    const updatedWorkflow: ParsedMrfWorkflow = {
      trigger: {
        defaultStepName: 'Trigger',
        formWorkflowStepId: 'trigger-001',
        type: 'static',
      },
      actions: [],
    }

    await createMrfSteps($, updatedWorkflow)

    const mrfActionSteps = await Step.query()
      .where('flow_id', mockFlowId)
      .where('type', 'action')
      .where('key', 'mrfSubmission')

    // All action steps should be deleted
    expect(mrfActionSteps).toHaveLength(0)

    // Trigger should still exist with updated parameters
    const trigger = await Step.query().findById(triggerStep.id)
    expect(trigger?.parameters.mrf).toEqual(updatedWorkflow.trigger)
  })

  it('should preserve non-MRF steps and move them down', async () => {
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
      ],
    }

    await createMrfSteps($, mrfWorkflow)

    const allSteps = await Step.query()
      .where('flow_id', mockFlowId)
      .orderBy('position', 'asc')

    // Should have trigger + 2 non-MRF + 1 MRF action
    expect(allSteps).toHaveLength(4)

    const nonMrfSteps = allSteps.filter((step) => step.key !== 'mrfSubmission')
    expect(nonMrfSteps).toHaveLength(3) // trigger + 2 non-MRF
    expect(nonMrfSteps.some((step) => step.key === 'delayFor')).toBe(true)
    expect(
      nonMrfSteps.some((step) => step.key === 'sendTransactionalEmail'),
    ).toBe(true)
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
            fields: [],
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
            fields: [],
            approvalField: 'approval1',
          },
          {
            defaultStepName: 'Action 2',
            formWorkflowStepId: 'action-002',
            type: 'static',
            fields: [],
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
            fields: [],
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

    it('should delete all steps after the last MRF action when it is deleted', async () => {
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
            fields: [],
            approvalField: 'approval1',
          },
          {
            defaultStepName: 'Action 2',
            formWorkflowStepId: 'action-002',
            type: 'static',
            fields: [],
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

      // Verify we have 6 steps
      let allSteps = await Step.query()
        .where('flow_id', mockFlowId)
        .orderBy('position', 'asc')
      expect(allSteps).toHaveLength(6)

      // Delete the second MRF action, keeping the first
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
            approvalField: 'approval1',
          },
        ],
      }

      await createMrfSteps($, updatedWorkflow)

      // Should have: trigger + 1 MRF action + 1 delay step from first branch
      // Second branch (MRF action 2 + 2 postman steps) should be deleted
      allSteps = await Step.query()
        .where('flow_id', mockFlowId)
        .orderBy('position', 'asc')

      expect(allSteps).toHaveLength(3)
      expect(allSteps[0].type).toBe('trigger')
      expect(allSteps[1].key).toBe('mrfSubmission')
      expect(get(allSteps[1].parameters, 'mrf.formWorkflowStepId')).toBe(
        'action-001',
      )
      // The delay step from the first branch should remain
      expect(allSteps[2].key).toBe('delayFor')
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
            fields: [],
            approvalField: 'approval1',
          },
          {
            defaultStepName: 'Action 2',
            formWorkflowStepId: 'action-002',
            type: 'static',
            fields: [],
            approvalField: 'approval2',
          },
          {
            defaultStepName: 'Action 3',
            formWorkflowStepId: 'action-003',
            type: 'static',
            fields: [],
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
            fields: [],
            approvalField: 'approval1',
          },
          {
            defaultStepName: 'Action 3',
            formWorkflowStepId: 'action-003',
            type: 'static',
            fields: [],
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
  })
})
