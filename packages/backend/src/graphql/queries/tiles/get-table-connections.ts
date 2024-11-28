import { raw } from 'objection'

import logger from '@/helpers/logger'
import Flow from '@/models/flow'
import Step from '@/models/step'
import TableCollaborator from '@/models/table-collaborators'

import type { QueryResolvers } from '../../__generated__/types.generated'

interface ExtendedFlow extends Flow {
  tableid: string
  count: number
}

interface TableConnection {
  [key: string]: number
}

const getTableConnections: QueryResolvers['getTableConnections'] = async (
  _parent,
  params,
  context,
) => {
  const { tableIds } = params
  if (!tableIds) {
    throw new Error('tableIds is required')
  }
  if (tableIds.length === 0) {
    return {}
  }

  try {
    // get distinct rows of tables used in flows
    // returns flow id and table id
    // MONITOR (ogp-kevin): add index on steps.parameters->>'tableId' if query is slow
    const distinctTableFlows = await Flow.query()
      .innerJoin(
        Step.query()
          .as('tileSteps')
          .select(
            raw("steps.parameters->>'tableId' AS tableid"),
            'steps.flow_id',
          )
          .andWhere('steps.app_key', 'tiles')
          .whereNotNull(raw("steps.parameters->>'tableId'"))
          .whereIn(
            raw("steps.parameters->>'tableId'"),
            TableCollaborator.query()
              .select(raw('"table_id"::TEXT AS table_id')) // Cast to TEXT, steps.parameters is JSONB
              .whereIn('table_id', tableIds)
              .where('user_id', context.currentUser.id),
          ), // Only include tables that the user has access to
        'flows.id',
        'tileSteps.flow_id',
      )
      .select('tileSteps.tableid')
      .countDistinct('flows.id')
      .groupBy('tileSteps.tableid')

    const result = distinctTableFlows.reduce(
      (acc: TableConnection, row: ExtendedFlow) => {
        acc[row.tableid] = row.count
        return acc
      },
      {},
    )

    return result
  } catch (e) {
    logger.error(e)
    throw new Error('Error fetching table connections')
  }
}

export default getTableConnections
