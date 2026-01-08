import { beforeEach, describe, expect, it } from 'vitest'

import { StepEnumType } from '@/graphql/__generated__/types.generated'
import createFlowWithSteps from '@/graphql/mutations/create-flow-with-steps'
import Flow from '@/models/flow'
import Step from '@/models/step'
import User from '@/models/user'
import Context from '@/types/express/context'

describe('createFlowWithSteps mutation integration tests', () => {
  let testUser: User
  let context: Context

  beforeEach(async () => {
    // Clean up database before each test
    await Step.query().delete()
    await Flow.query().delete()

    testUser = await User.query().findOne({ email: 'tester@open.gov.sg' })
    context = {
      req: null,
      currentUser: testUser,
      res: null,
      isAdminOperation: false,
    }
  })

  describe('happy flow', () => {
    it('should create a flow with steps successfully', async () => {
      const params = {
        input: {
          flowName: 'My Test Flow',
          steps: [
            {
              type: 'trigger' as StepEnumType,
              appKey: 'scheduler',
              key: 'everyHour',
              position: 1,
              config: {},
            },
            {
              type: 'action' as StepEnumType,
              appKey: 'postman',
              key: 'sendTransactionalEmail',
              position: 2,
              config: {},
            },
            {
              type: 'action' as StepEnumType,
              appKey: 'slack',
              key: 'sendMessageToChannel',
              position: 3,
              config: {},
            },
          ],
          aiBuilderConfig: {
            type: 'form',
            traceId: '123',
          },
        },
      }

      const result = await createFlowWithSteps(null, params, context)

      // Verify flow was created
      expect(result).toBeDefined()
      expect(result.name).toBe('My Test Flow')
      expect(result.config).toEqual({
        aiBuilderConfig: {
          type: 'form',
          traceId: '123',
        },
      })
      expect(result.userId).toBe(testUser.id)

      // Verify steps were created and inserted correctly
      const steps = await Step.query()
        .where('flow_id', result.id)
        .orderBy('position', 'asc')

      expect(steps).toHaveLength(3)

      expect(steps[0]?.type).toBe('trigger')
      expect(steps[0].appKey).toBe('scheduler')
      expect(steps[0].key).toBe('everyHour')
      expect(steps[0].position).toBe(1)
      expect(steps[0].config).toEqual({})

      expect(steps[1].type).toBe('action')
      expect(steps[1].appKey).toBe('postman')
      expect(steps[1].key).toBe('sendTransactionalEmail')
      expect(steps[1].position).toBe(2)
      expect(steps[1].config).toEqual({})

      expect(steps[2].type).toBe('action')
      expect(steps[2].appKey).toBe('slack')
      expect(steps[2].key).toBe('sendMessageToChannel')
      expect(steps[2].position).toBe(3)
      expect(steps[2].config).toEqual({})
    })

    it('should trim flow name and create flow', async () => {
      const params = {
        input: {
          flowName: '  Trimmed Flow Name  ',
          steps: [
            {
              type: 'trigger' as StepEnumType,
              appKey: 'scheduler',
              key: 'everyHour',
              position: 1,
              config: {},
            },
            {
              type: 'action' as StepEnumType,
              appKey: 'postman',
              key: 'sendTransactionalEmail',
              position: 2,
              config: {},
            },
          ],
          aiBuilderConfig: {
            type: 'form',
            traceId: '123',
          },
        },
      }

      const result = await createFlowWithSteps(null, params, context)

      expect(result.name).toBe('Trimmed Flow Name')
    })

    it('should handle steps without config field', async () => {
      const params = {
        input: {
          flowName: 'Test Flow',
          steps: [
            {
              type: 'trigger' as StepEnumType,
              appKey: 'scheduler',
              key: 'everyHour',
              position: 1,
            },
            {
              type: 'action' as StepEnumType,
              appKey: 'postman',
              key: 'sendTransactionalEmail',
              position: 2,
            },
          ],
          aiBuilderConfig: {
            type: 'form',
            traceId: '123',
          },
        },
      }

      const result = await createFlowWithSteps(null, params, context)
      const steps = await Step.query()
        .where('flow_id', result.id)
        .orderBy('position', 'asc')

      expect(steps[0].config).toEqual({})
      expect(steps[1].config).toEqual({})
    })

    it('should allow single trigger with multiple actions', async () => {
      const params = {
        input: {
          flowName: 'Test Flow',
          steps: [
            {
              type: 'trigger' as StepEnumType,
              appKey: 'scheduler',
              key: 'everyHour',
              position: 1,
              config: {},
            },
            {
              type: 'action' as StepEnumType,
              appKey: 'postman',
              key: 'sendTransactionalEmail',
              position: 2,
              config: {},
            },
            {
              type: 'action' as StepEnumType,
              appKey: 'slack',
              key: 'sendMessageToChannel',
              position: 3,
              config: {},
            },
            {
              type: 'action' as StepEnumType,
              appKey: 'delay',
              key: 'delayFor',
              position: 4,
              config: {},
            },
          ],
          aiBuilderConfig: {
            type: 'form',
            traceId: '123',
          },
        },
      }

      const result = await createFlowWithSteps(null, params, context)
      const steps = await Step.query()
        .where('flow_id', result.id)
        .orderBy('position', 'asc')

      expect(steps).toHaveLength(4)
      expect(steps[0]?.type).toBe('trigger')
      expect(steps[1]?.type).toBe('action')
      expect(steps[2]?.type).toBe('action')
      expect(steps[3]?.type).toBe('action')
    })
  })

  describe('validation errors', () => {
    it('should throw error when flow name is empty', async () => {
      const params = {
        input: {
          flowName: '   ',
          steps: [
            {
              type: 'trigger' as StepEnumType,
              appKey: 'scheduler',
              key: 'everyHour',
              position: 1,
              config: {},
            },
          ],
          aiBuilderConfig: {
            type: 'form',
            traceId: '123',
          },
        },
      }

      await expect(createFlowWithSteps(null, params, context)).rejects.toThrow(
        'Pipe name needs to have at least 1 character.',
      )

      // Verify no flow was created
      const flows = await Flow.query()
      expect(flows).toHaveLength(0)
    })

    it('should throw error when flow name is empty string', async () => {
      const params = {
        input: {
          flowName: '',
          steps: [
            {
              type: 'trigger' as StepEnumType,
              appKey: 'scheduler',
              key: 'everyHour',
              position: 1,
              config: {},
            },
          ],
          aiBuilderConfig: {
            type: 'form',
            traceId: '123',
          },
        },
      }

      await expect(createFlowWithSteps(null, params, context)).rejects.toThrow(
        'Pipe name needs to have at least 1 character.',
      )

      // Verify no flow was created
      const flows = await Flow.query()
      expect(flows).toHaveLength(0)
    })

    it('should throw when there are no action steps', async () => {
      const params = {
        input: {
          flowName: 'Test Flow',
          steps: [
            {
              type: 'trigger' as StepEnumType,
              appKey: 'scheduler',
              key: 'everyHour',
              position: 1,
              config: {},
            },
          ],
          aiBuilderConfig: {
            type: 'form',
            traceId: '123',
          },
        },
      }

      await expect(createFlowWithSteps(null, params, context)).rejects.toThrow(
        'Pipe contains invalid action steps',
      )

      // Verify no flow was created
      const flows = await Flow.query()
      expect(flows).toHaveLength(0)
    })
  })

  describe('non-contiguous steps', () => {
    it('should throw error when steps have gaps in positions', async () => {
      const params = {
        input: {
          flowName: 'Test Flow',
          steps: [
            {
              type: 'trigger' as StepEnumType,
              appKey: 'scheduler',
              key: 'everyHour',
              position: 1,
              config: {},
            },
            {
              type: 'action' as StepEnumType,
              appKey: 'gmail',
              key: 'send-email',
              position: 3, // Gap: missing position 2
              config: {},
            },
          ],
          aiBuilderConfig: {
            type: 'form',
            traceId: '123',
          },
        },
      }

      await expect(createFlowWithSteps(null, params, context)).rejects.toThrow(
        'Must be contiguous steps!',
      )

      // Verify no flow was created due to transaction rollback
      const flows = await Flow.query()
      expect(flows).toHaveLength(0)
    })

    it('should throw error when steps are out of order', async () => {
      const params = {
        input: {
          flowName: 'Test Flow',
          steps: [
            {
              type: 'trigger' as StepEnumType,
              appKey: 'scheduler',
              key: 'everyHour',
              position: 1,
              config: {},
            },
            {
              type: 'action' as StepEnumType,
              appKey: 'slack',
              key: 'send-message',
              position: 3,
              config: {},
            },
            {
              type: 'action' as StepEnumType,
              appKey: 'gmail',
              key: 'send-email',
              position: 2, // Out of order
              config: {},
            },
          ],
          aiBuilderConfig: {
            type: 'form',
            traceId: '123',
          },
        },
      }

      await expect(createFlowWithSteps(null, params, context)).rejects.toThrow(
        'Must be contiguous steps!',
      )

      // Verify no flow was created due to transaction rollback
      const flows = await Flow.query()
      expect(flows).toHaveLength(0)
    })

    it('should throw error when first step does not start at position 1', async () => {
      const params = {
        input: {
          flowName: 'Test Flow',
          steps: [
            {
              type: 'trigger' as StepEnumType,
              appKey: 'scheduler',
              key: 'every-hour',
              position: 2, // Should start at 1
              config: {},
            },
            {
              type: 'action' as StepEnumType,
              appKey: 'gmail',
              key: 'send-email',
              position: 3,
              config: {},
            },
          ],
          aiBuilderConfig: {
            type: 'form',
            traceId: '123',
          },
        },
      }

      await expect(createFlowWithSteps(null, params, context)).rejects.toThrow(
        'Must be contiguous steps!',
      )

      // Verify no flow was created due to transaction rollback
      const flows = await Flow.query()
      expect(flows).toHaveLength(0)
    })
  })

  describe('trigger validation', () => {
    it('should throw error when pipe does not start with a trigger', async () => {
      const params = {
        input: {
          flowName: 'Test Flow',
          steps: [
            {
              type: 'action' as StepEnumType, // Should be trigger
              appKey: 'gmail',
              key: 'send-email',
              position: 1,
              config: {},
            },
            {
              type: 'action' as StepEnumType,
              appKey: 'slack',
              key: 'send-message',
              position: 2,
              config: {},
            },
          ],
          aiBuilderConfig: {
            type: 'form',
            traceId: '123',
          },
        },
      }

      await expect(createFlowWithSteps(null, params, context)).rejects.toThrow(
        'Pipe must always start with a trigger',
      )

      // Verify no flow was created due to transaction rollback
      const flows = await Flow.query()
      expect(flows).toHaveLength(0)
    })

    it('should throw error when first position step is missing', async () => {
      const params = {
        input: {
          flowName: 'Test Flow',
          steps: [
            {
              type: 'action' as StepEnumType,
              appKey: 'gmail',
              key: 'send-email',
              position: 2,
              config: {},
            },
            {
              type: 'action' as StepEnumType,
              appKey: 'slack',
              key: 'send-message',
              position: 3,
              config: {},
            },
          ],
          aiBuilderConfig: {
            type: 'form',
            traceId: '123',
          },
        },
      }

      await expect(createFlowWithSteps(null, params, context)).rejects.toThrow(
        'Must be contiguous steps!',
      )

      // Verify no flow was created due to transaction rollback
      const flows = await Flow.query()
      expect(flows).toHaveLength(0)
    })

    it('should throw error when trigger is an invalid trigger app', async () => {
      const params = {
        input: {
          flowName: 'Test Flow',
          steps: [
            {
              type: 'trigger' as StepEnumType,
              appKey: 'postman',
              key: 'sendTransactionalEmail',
              position: 1,
              config: {},
            },
          ],
          aiBuilderConfig: {
            type: 'form',
            traceId: '123',
          },
        },
      }

      await expect(createFlowWithSteps(null, params, context)).rejects.toThrow(
        'Pipe must always start with a trigger',
      )

      // Verify no flow was created due to transaction rollback
      const flows = await Flow.query()
      expect(flows).toHaveLength(0)
    })
  })

  it('should throw error when pipe contains more than one trigger', async () => {
    const params = {
      input: {
        flowName: 'Test Flow',
        steps: [
          {
            type: 'trigger' as StepEnumType,
            appKey: 'scheduler',
            key: 'everyHour',
            position: 1,
            config: {},
          },
          {
            type: 'action' as StepEnumType,
            appKey: 'webhook',
            key: 'catch-hook',
            position: 2,
            config: {},
          },
          {
            type: 'trigger' as StepEnumType, // Second trigger - not allowed
            appKey: 'gmail',
            key: 'send-email',
            position: 3,
            config: {},
          },
        ],
        aiBuilderConfig: {
          type: 'form',
          traceId: '123',
        },
      },
    }

    await expect(createFlowWithSteps(null, params, context)).rejects.toThrow(
      'Pipe contains invalid action steps',
    )

    // Verify no flow was created due to transaction rollback
    const flows = await Flow.query()
    expect(flows).toHaveLength(0)
  })

  describe('if-then step validation', () => {
    it('should successfully create flow with valid if-then steps', async () => {
      const params = {
        input: {
          flowName: 'Test Flow with If-Then',
          steps: [
            {
              type: 'trigger' as StepEnumType,
              appKey: 'scheduler',
              key: 'everyHour',
              position: 1,
              config: {},
            },
            {
              type: 'action' as StepEnumType,
              appKey: 'toolbox',
              key: 'ifThen',
              position: 2,
              config: {},
              parameters: {
                depth: 0,
                branchName: 'If',
              },
            },
            {
              type: 'action' as StepEnumType,
              appKey: 'postman',
              key: 'sendTransactionalEmail',
              position: 3,
              config: {},
              parameters: {},
            },
            {
              type: 'action' as StepEnumType,
              appKey: 'toolbox',
              key: 'ifThen',
              position: 4,
              config: {},
              parameters: {
                depth: 0,
                branchName: 'Else',
              },
            },
            {
              type: 'action' as StepEnumType,
              appKey: 'slack',
              key: 'sendMessageToChannel',
              position: 5,
              config: {},
            },
          ],
          aiBuilderConfig: {
            type: 'form',
            traceId: '123',
          },
        },
      }

      const result = await createFlowWithSteps(null, params, context)

      expect(result).toBeDefined()
      expect(result.name).toBe('Test Flow with If-Then')

      const steps = await Step.query()
        .where('flow_id', result.id)
        .orderBy('position', 'asc')

      expect(steps).toHaveLength(5)
      expect(steps[1].key).toBe('ifThen')
      expect(steps[1].parameters).toEqual({ depth: 0, branchName: 'If' })
      expect(steps[3].key).toBe('ifThen')
      expect(steps[3].parameters).toEqual({ depth: 0, branchName: 'Else' })
    })

    // it('should throw error when if-then step is missing depth parameter', async () => {
    //   const params = {
    //     input: {
    //       flowName: 'Test Flow',
    //       steps: [
    //         {
    //           type: 'trigger' as StepEnumType,
    //           appKey: 'scheduler',
    //           key: 'everyHour',
    //           position: 1,
    //           config: {},
    //         },
    //         {
    //           type: 'action' as StepEnumType,
    //           appKey: 'toolbox',
    //           key: 'ifThen',
    //           position: 2,
    //           config: {},
    //           parameters: {
    //             branchName: 'If',
    //             // missing depth
    //           },
    //         },
    //       ],
    //       aiBuilderConfig: {
    //         type: 'form',
    //         traceId: '123',
    //       },
    //     },
    //   }

    //   await expect(createFlowWithSteps(null, params, context)).rejects.toThrow(
    //     'Pipe contains invalid action steps',
    //   )

    //   const flows = await Flow.query()
    //   expect(flows).toHaveLength(0)
    // })

    // it('should throw error when if-then step is missing branchName parameter', async () => {
    //   const params = {
    //     input: {
    //       flowName: 'Test Flow',
    //       steps: [
    //         {
    //           type: 'trigger' as StepEnumType,
    //           appKey: 'scheduler',
    //           key: 'everyHour',
    //           position: 1,
    //           config: {},
    //         },
    //         {
    //           type: 'action' as StepEnumType,
    //           appKey: 'toolbox',
    //           key: 'ifThen',
    //           position: 2,
    //           config: {},
    //           parameters: {
    //             depth: 0,
    //             // missing branchName
    //           },
    //         },
    //       ],
    //       aiBuilderConfig: {
    //         type: 'form',
    //         traceId: '123',
    //       },
    //     },
    //   }

    //   await expect(createFlowWithSteps(null, params, context)).rejects.toThrow(
    //     'Pipe contains invalid action steps',
    //   )

    //   const flows = await Flow.query()
    //   expect(flows).toHaveLength(0)
    // })

    // it('should throw error when if-then step has no parameters', async () => {
    //   const params = {
    //     input: {
    //       flowName: 'Test Flow',
    //       steps: [
    //         {
    //           type: 'trigger' as StepEnumType,
    //           appKey: 'scheduler',
    //           key: 'everyHour',
    //           position: 1,
    //           config: {},
    //         },
    //         {
    //           type: 'action' as StepEnumType,
    //           appKey: 'toolbox',
    //           key: 'ifThen',
    //           position: 2,
    //           config: {},
    //           // missing parameters entirely
    //         },
    //       ],
    //       aiBuilderConfig: {
    //         type: 'form',
    //         traceId: '123',
    //       },
    //     },
    //   }

    //   await expect(createFlowWithSteps(null, params, context)).rejects.toThrow(
    //     'Pipe contains invalid action steps',
    //   )

    //   const flows = await Flow.query()
    //   expect(flows).toHaveLength(0)
    // })

    // it('should throw error when if-then step has empty parameters object', async () => {
    //   const params = {
    //     input: {
    //       flowName: 'Test Flow',
    //       steps: [
    //         {
    //           type: 'trigger' as StepEnumType,
    //           appKey: 'scheduler',
    //           key: 'everyHour',
    //           position: 1,
    //           config: {},
    //         },
    //         {
    //           type: 'action' as StepEnumType,
    //           appKey: 'toolbox',
    //           key: 'ifThen',
    //           position: 2,
    //           config: {},
    //           parameters: {},
    //         },
    //       ],
    //       aiBuilderConfig: {
    //         type: 'form',
    //         traceId: '123',
    //       },
    //     },
    //   }

    //   await expect(createFlowWithSteps(null, params, context)).rejects.toThrow(
    //     'Pipe contains invalid action steps',
    //   )

    //   const flows = await Flow.query()
    //   expect(flows).toHaveLength(0)
    // })
  })
})
