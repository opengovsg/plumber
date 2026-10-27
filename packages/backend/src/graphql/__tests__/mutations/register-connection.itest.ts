import { randomUUID } from 'crypto'

import { beforeEach, describe, expect, it } from 'vitest'

import registerConnection from '@/graphql/mutations/register-connection'
import Connection from '@/models/connection'
import Flow from '@/models/flow'
import FlowConnections from '@/models/flow-connections'
import User from '@/models/user'
import Context from '@/types/express/context'

import {
  generateMockCollaborator,
  generateMockFlow,
  generateMockUser,
} from './flow.mock'
import { generateMockContext } from './tiles/table.mock'

describe('registerConnection', () => {
  let context: Context
  let owner: User
  let editor: User
  let testFlow: Flow
  let ownerConnection: Connection

  beforeEach(async () => {
    await FlowConnections.query().delete()
    await Connection.query().delete()
    await Flow.query().delete()

    context = await generateMockContext()
    owner = context.currentUser
    editor = await generateMockUser('editor')
    testFlow = await generateMockFlow(context, randomUUID())
    await generateMockCollaborator(testFlow.id, editor.id, owner.id, 'editor')

    ownerConnection = await Connection.query().insertAndFetch({
      userId: owner.id,
      key: 'slack',
      formattedData: { screenName: 'Owner Slack' },
      verified: true,
    })
  })

  it('rejects a foreign personal connection', async () => {
    await FlowConnections.query().insert({
      flowId: testFlow.id,
      connectionId: ownerConnection.id,
      connectionType: 'connection',
      addedBy: owner.id,
    })

    context.currentUser = editor

    await expect(
      registerConnection(
        null,
        {
          input: {
            connectionId: ownerConnection.id,
            flowId: testFlow.id,
          },
        },
        context,
      ),
    ).rejects.toThrow(
      'You cannot register a personal connection that you do not own',
    )
  })
})
