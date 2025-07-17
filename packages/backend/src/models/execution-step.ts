import { IExecutionStepMetadata, IJSONObject } from '@plumber/types'

import { raw } from 'objection'

import appConfig from '@/config/app'

import Base from './base'
import Execution from './execution'
import Step from './step'

class ExecutionStep extends Base {
  id!: string
  executionId!: string
  stepId!: string
  dataIn!: IJSONObject
  dataOut!: IJSONObject
  errorDetails: IJSONObject
  status: 'success' | 'failure'
  appKey: string
  jobId: string
  step: Step
  metadata: IExecutionStepMetadata
  key: string
  execution?: Execution

  static tableName = 'execution_steps'

  static jsonSchema = {
    type: 'object',

    properties: {
      id: { type: 'string', format: 'uuid' },
      executionId: { type: 'string', format: 'uuid' },
      stepId: { type: 'string' },
      dataIn: { type: ['object', 'null'] },
      dataOut: { type: ['object', 'null'] },
      status: { type: 'string', enum: ['success', 'failure'] },
      errorDetails: { type: ['object', 'null'] },
      appKey: { type: ['string', 'null'] },
      jobId: { type: ['string', 'null'] },
      key: { type: ['string', 'null'] },
      metadata: {
        type: 'object',
        properties: {
          isMock: {
            type: 'boolean',
          },
          // this is purely used to tell frontend that there is a past test submission
          lastTestSubmissionDate: {
            type: 'string',
          },
          iteration: {
            type: 'number',
          },
          iterationStatus: {
            type: 'object',
          },
          isLastIteration: {
            type: 'boolean',
          },
          isLastStep: {
            type: 'boolean',
          },
        },
      },
    },
  }

  static get virtualAttributes() {
    return ['iconUrl']
  }

  static relationMappings = () => ({
    execution: {
      relation: Base.BelongsToOneRelation,
      modelClass: Execution,
      join: {
        from: 'execution_steps.execution_id',
        to: 'executions.id',
      },
    },
    step: {
      relation: Base.BelongsToOneRelation,
      modelClass: Step,
      join: {
        from: 'execution_steps.step_id',
        to: 'steps.id',
      },
    },
  })

  get isFailed() {
    return this.status === 'failure'
  }

  get iconUrl() {
    if (!this.appKey) {
      return null
    }

    return `${appConfig.baseUrl}/apps/${this.appKey}/assets/favicon.svg`
  }

  static async patchIterationStatus(
    executionId: string,
    iteration: number,
    status: 'success' | 'failure' | 'partial-success' | null,
  ) {
    const updateData =
      status !== null
        ? {
            metadata: raw(
              `jsonb_set(metadata, '{iterationStatus,iteration_${iteration}}', to_jsonb(?::text), true)`,
              [status],
            ),
          }
        : {
            metadata: raw(
              `jsonb_set(metadata, '{iterationStatus,iteration_${iteration}}', 'null'::jsonb, true)`,
            ),
          }

    return ExecutionStep.query()
      .where('execution_id', executionId)
      .where('app_key', 'toolbox')
      .where('key', 'forEach')
      .patch(updateData)
  }

  static async getIterationSteps(executionId: string, iteration: number) {
    return ExecutionStep.query()
      .select('execution_steps.*', 'latest_steps.min_created_at')
      .with('latest_steps', (builder) => {
        builder
          .select(
            'step_id',
            raw('MAX(created_at) as max_created_at'),
            raw('MIN(created_at) as min_created_at'),
          )
          .from('execution_steps')
          .where('execution_id', executionId)
          .groupBy('step_id')
          .groupBy(
            raw(`
              CASE
                WHEN metadata = '{}'::jsonb THEN NULL
                ELSE metadata ->> 'iteration'
              END
            `),
          )
      })
      .join('latest_steps', (builder) => {
        builder
          .on('execution_steps.step_id', '=', 'latest_steps.step_id')
          .andOn(
            'execution_steps.created_at',
            '=',
            'latest_steps.max_created_at',
          )
      })
      .where('execution_steps.execution_id', executionId)
      .where(
        raw(`(execution_steps.metadata ->> 'iteration')::int = ?`, [iteration]),
      )
      .orderBy('latest_steps.min_created_at', 'asc')
  }

  /**
   * checks the state of the for-each execution by looking at the iterationStatus
   * metadata field
   *
   * returns:
   * - hasLastIterationRun: boolean
   *   mainly used during retry to determine whether to set the execution to status to success
   * - areAllStepsSuccessful: boolean
   */
  static async getForEachExecutionState(executionId: string) {
    const forEachStep = await ExecutionStep.query()
      .where('execution_id', executionId)
      .where('app_key', 'toolbox')
      .where('key', 'forEach')
      .first()
    const iterationStatus = forEachStep?.metadata?.iterationStatus

    return {
      hasLastIterationRun:
        iterationStatus &&
        Object.values(iterationStatus).every((value) => value !== null),
      areAllStepsSuccessful:
        iterationStatus &&
        Object.values(iterationStatus).every(
          (value) => value === 'success' || value === 'partial-success',
        ),
    }
  }
}

export default ExecutionStep
