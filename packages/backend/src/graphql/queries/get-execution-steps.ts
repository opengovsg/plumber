import { raw } from 'objection'

import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
} from '@/apps/toolbox/common/constants'
import paginate from '@/helpers/pagination'

import type { QueryResolvers } from '../__generated__/types.generated'

const getExecutionSteps: QueryResolvers['getExecutionSteps'] = async (
  _parent,
  params,
  context,
) => {
  const execution = await context.currentUser
    .$relatedQuery('executions')
    .withSoftDeleted()
    .findById(params.executionId)
    .throwIfNotFound()

  // get most recent execution step for each step
  const executionSteps = execution
    .$relatedQuery('executionSteps')
    .with('latest_steps', (builder) => {
      builder
        .select(
          'step_id',
          raw('max(created_at) as max_created_at'),
          raw('min(created_at) as min_created_at'),
        )
        .from('execution_steps')
        .groupBy('step_id')
        .where('execution_id', '=', execution.id)
        .withSoftDeleted()
    })
    .join('latest_steps', (builder) => {
      builder
        .on('execution_steps.step_id', '=', 'latest_steps.step_id')
        .andOn('execution_steps.created_at', '=', 'latest_steps.max_created_at')
    })
    .select('execution_steps.*', 'min_created_at')
    .withSoftDeleted()
    .orderBy('min_created_at', 'asc')

  // check if the execution has a for-each step
  const hasForEach = await executionSteps
    .clone()
    .findOne({
      app_key: TOOLBOX_APP_KEY,
      key: TOOLBOX_ACTIONS.FOR_EACH,
    })
    .then((result) => !!result)

  // NOTE: use a separate query for for-each
  // as there are multiple execution steps with the same step_id in the same execution
  if (hasForEach) {
    const forEachExecutionSteps = execution
      .$relatedQuery('executionSteps')
      .with('latest_steps', (builder) => {
        /**
         * NOTE: there is a known issue with knex where 'groupBy' are placed at the end of the 'unionAll' query.
         * the workaround is to unionAll both queries with 'true' to wrap the subequery.
         */
        builder
          .unionAll((qb) => {
            qb.select(
              'step_id',
              raw('max(created_at) as max_created_at'),
              raw('min(created_at) as min_created_at'),
            )
              .from('execution_steps')
              .groupBy('step_id')
              .where('execution_id', '=', execution.id)
              .where(raw("metadata = '{}'::jsonb"))
              .withSoftDeleted()
          }, true)
          .unionAll((qb) => {
            qb.select(
              'step_id',
              raw('max(created_at) as max_created_at'),
              raw('min(created_at) as min_created_at'),
            )
              .from('execution_steps')
              .groupBy('step_id', raw("metadata->>'iteration'"))
              .where('execution_id', '=', execution.id)
              .where(raw("metadata != '{}'::jsonb"))
              .withSoftDeleted()
          }, true)
          .withSoftDeleted()
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
      .select('execution_steps.*', 'min_created_at')
      .withSoftDeleted()
      .orderBy('min_created_at', 'asc')

    const allRecords = await forEachExecutionSteps
    return {
      pageInfo: {
        currentPage: 1,
        totalCount: 100,
      },
      edges: allRecords.map((record) => ({
        node: record,
      })),
    }
  }

  return paginate(executionSteps, params.limit, params.offset)
}

export default getExecutionSteps
