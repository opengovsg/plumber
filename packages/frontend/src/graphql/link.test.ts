import type { Operation } from '@apollo/client'
import { ApolloLink, execute, from, gql, Observable } from '@apollo/client'
import { describe, expect, it, vi } from 'vitest'

import { NOT_AUTHORISED } from '@/config/errors'

import { createErrorLink } from './link'

const query = gql`
  query TestQuery {
    test
  }
`

function runLink(
  handler: (operation: Operation) => Observable<Record<string, unknown>>,
) {
  const callback = vi.fn()
  const link = from([createErrorLink(callback), new ApolloLink(handler)])

  return new Promise<typeof callback>((resolve) => {
    execute(link, { query }).subscribe({
      next: () => resolve(callback),
      error: () => resolve(callback),
      complete: () => resolve(callback),
    })
  })
}

describe('createErrorLink', () => {
  it('reports a network error when the request has no response', async () => {
    const callback = await runLink(
      () =>
        new Observable((observer) => {
          observer.error(new TypeError('Failed to fetch'))
        }),
    )

    expect(callback).toHaveBeenCalledWith('TypeError: Failed to fetch')
  })

  it('reports not authorised for a 401 response', async () => {
    const callback = await runLink(
      (operation) =>
        new Observable((observer) => {
          operation.setContext({ response: { status: 401 } })
          observer.error(new Error('Unauthorised'))
        }),
    )

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(NOT_AUTHORISED)
  })

  it('reports the message of a GraphQL error', async () => {
    const callback = await runLink(
      (operation) =>
        new Observable((observer) => {
          operation.setContext({ response: { status: 200 } })
          observer.next({
            errors: [{ message: 'Flow not found', code: 'NOT_FOUND' }],
          })
          observer.complete()
        }),
    )

    expect(callback).toHaveBeenCalledWith('Flow not found')
  })
})
