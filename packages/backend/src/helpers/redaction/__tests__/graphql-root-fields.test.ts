import type { Request } from 'express'
import { Kind, parse } from 'graphql'
import { describe, expect, it } from 'vitest'

import {
  readGraphqlRootFields,
  StampGraphqlRootFields,
} from '../graphql-root-fields'

type Listener = { didResolveOperation: (context: never) => Promise<void> }

function operationOf(document: string) {
  return parse(document).definitions.find(
    (definition) => definition.kind === Kind.OPERATION_DEFINITION,
  )
}

async function runPlugin(requestContext: unknown): Promise<void> {
  const listener = (await StampGraphqlRootFields().requestDidStart(
    requestContext as never,
  )) as Listener
  await listener.didResolveOperation(requestContext as never)
}

async function stamp(document: string | undefined): Promise<Request> {
  const req = {} as Request
  await runPlugin({
    operation: document ? operationOf(document) : undefined,
    contextValue: { req },
  })
  return req
}

describe('StampGraphqlRootFields', () => {
  it('stamps the root field name', async () => {
    const req = await stamp('mutation Foo { updateStep(input: $input) { id } }')

    expect(readGraphqlRootFields(req)).toEqual(['updateStep'])
  })

  it('stamps the field name, not the alias', async () => {
    const req = await stamp(
      'mutation Foo { renamed: updateStep(input: $input) { id } }',
    )

    expect(readGraphqlRootFields(req)).toEqual(['updateStep'])
  })

  it('stamps every root field of a multi-field operation', async () => {
    const req = await stamp(
      'mutation Foo { updateStep(input: $a) { id } createStep(input: $b) { id } }',
    )

    expect(readGraphqlRootFields(req)).toEqual(['updateStep', 'createStep'])
  })

  it('stamps nothing when apollo resolved no operation', async () => {
    const req = await stamp(undefined)

    expect(readGraphqlRootFields(req)).toBe(undefined)
  })

  it('does not throw when it cannot reach the request', async () => {
    await expect(
      runPlugin({
        operation: operationOf('query Foo { getCurrentUser { id } }'),
      }),
    ).resolves.toBeUndefined()
  })
})

describe('readGraphqlRootFields', () => {
  it('returns undefined for an unstamped request', () => {
    expect(readGraphqlRootFields({} as Request)).toBe(undefined)
  })
})
