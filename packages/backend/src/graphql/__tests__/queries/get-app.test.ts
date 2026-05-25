import fs from 'fs'
import path from 'path'

import { buildSchema, graphql } from 'graphql'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findOneByKey: vi.fn(),
}))

vi.mock('@/models/app', () => ({
  default: {
    findOneByKey: mocks.findOneByKey,
  },
}))

const buildAppSchema = async () => {
  const typeDefs = fs.readFileSync(
    path.resolve(__dirname, '../../schema.graphql'),
    'utf8',
  )
  const schema = buildSchema(typeDefs)
  const { default: getApp } = await import('@/graphql/queries/get-app')
  return { schema, getApp }
}

const context = {
  currentUser: { id: 'test-user' },
} as any

describe('GraphQL Action/Trigger testStepTooltip field', () => {
  it('returns testStepTooltip on Action when set on the action object', async () => {
    mocks.findOneByKey.mockResolvedValue({
      key: 'postman',
      name: 'Postman',
      iconUrl: '',
      actions: [
        {
          key: 'sendEmail',
          name: 'Send email',
          description: '',
          testStepTooltip:
            'Test email will only be sent to your email address.',
        },
        {
          key: 'noTooltipAction',
          name: 'Other',
          description: '',
        },
      ],
    })

    const { schema, getApp } = await buildAppSchema()
    const result = await graphql({
      schema,
      source: `query GetApp { getApp(key: "postman") { actions { key testStepTooltip } } }`,
      contextValue: context,
      rootValue: {
        getApp: (args: any) => getApp(null as any, args, context),
      },
    })

    expect(result.errors).toBeUndefined()
    expect(result.data?.getApp).toEqual({
      actions: [
        {
          key: 'sendEmail',
          testStepTooltip:
            'Test email will only be sent to your email address.',
        },
        {
          key: 'noTooltipAction',
          testStepTooltip: null,
        },
      ],
    })
  })

  it('returns testStepTooltip on Trigger when set on the trigger object', async () => {
    mocks.findOneByKey.mockResolvedValue({
      key: 'someApp',
      name: 'Some App',
      iconUrl: '',
      triggers: [
        {
          key: 'someTrigger',
          name: 'Some trigger',
          description: '',
          testStepTooltip: 'Test trigger note.',
        },
      ],
    })

    const { schema, getApp } = await buildAppSchema()
    const result = await graphql({
      schema,
      source: `query GetApp { getApp(key: "someApp") { triggers { key testStepTooltip } } }`,
      contextValue: context,
      rootValue: {
        getApp: (args: any) => getApp(null as any, args, context),
      },
    })

    expect(result.errors).toBeUndefined()
    expect(result.data?.getApp).toEqual({
      triggers: [
        {
          key: 'someTrigger',
          testStepTooltip: 'Test trigger note.',
        },
      ],
    })
  })
})
