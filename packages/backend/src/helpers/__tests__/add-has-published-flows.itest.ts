import { randomUUID } from 'crypto'

import { beforeEach, describe, expect, it } from 'vitest'

import {
  generateMockFlow,
  generateMockStep,
} from '@/graphql/__tests__/mutations/flow.mock'
import { generateMockContext } from '@/graphql/__tests__/mutations/tiles/table.mock'
import Connection from '@/models/connection'
import Flow from '@/models/flow'
import FlowConnections from '@/models/flow-connections'
import Step from '@/models/step'
import Context from '@/types/express/context'

import addHasPublishedFlows from '../add-has-published-flows'

describe('addHasPublishedFlows', () => {
  let context: Context
  let connection: Connection

  const useConnectionInFlow = async (active: boolean) => {
    const flow = await generateMockFlow(context, randomUUID())
    const step = await generateMockStep(
      context,
      'createTableRow',
      'm365-excel',
      'action',
      flow.id,
      2,
    )
    await Step.query().findById(step.id).patch({ connectionId: connection.id })
    // IMPORTANT: Publish last. Step hooks reject edits to a published pipe.
    await Flow.knex().table('flows').where('id', flow.id).update({ active })
    return flow
  }

  const fetchConnections = () =>
    addHasPublishedFlows(
      context.currentUser
        .$relatedQuery('connections')
        .select('connections.*')
        .fullOuterJoinRelated('steps')
        .countDistinct('steps.flow_id as flowCount')
        .groupBy('connections.id'),
    )

  beforeEach(async () => {
    await FlowConnections.query().delete()
    await Step.query().delete()
    await Flow.query().delete()
    await Connection.query().delete()

    context = await generateMockContext()
    connection = await Connection.query().insertAndFetch({
      userId: context.currentUser.id,
      key: 'm365-excel',
      formattedData: { screenName: 'Test M365' },
      verified: true,
    })
  })

  it('is false for a connection no pipe uses', async () => {
    const [result] = await fetchConnections()
    expect(result.hasPublishedFlows).toBe(false)
  })

  it('is false when only unpublished pipes use the connection', async () => {
    await useConnectionInFlow(false)
    const [result] = await fetchConnections()
    expect(result.hasPublishedFlows).toBe(false)
  })

  it('is true when any pipe using the connection is published', async () => {
    await useConnectionInFlow(false)
    await useConnectionInFlow(true)
    const [result] = await fetchConnections()
    expect(result.hasPublishedFlows).toBe(true)
    expect(Number(result.flowCount)).toBe(2)
  })

  it('is false when the published pipe is deleted', async () => {
    const flow = await useConnectionInFlow(true)
    await Flow.query().findById(flow.id).delete()
    const [result] = await fetchConnections()
    expect(result.hasPublishedFlows).toBe(false)
  })
})
