// @vitest-environment jsdom
import { execute, gql } from '@apollo/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import createLink, { TILE_MIGRATING_EVENT } from '../link'

const QUERY = gql`
  mutation TileMigratingLinkTest {
    createRow
  }
`

function stubGraphqlErrorResponse(code: string, message: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify({ errors: [{ message, code }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    ),
  )
}

function run(onError: (message: string) => void): Promise<void> {
  const link = createLink({ uri: 'http://localhost/graphql', onError })
  return new Promise((resolve) => {
    execute(link, { query: QUERY }).subscribe({
      complete: resolve,
      error: () => resolve(),
    })
  })
}

describe('createLink error handling', () => {
  const listener = vi.fn()

  beforeEach(() => {
    window.addEventListener(TILE_MIGRATING_EVENT, listener)
  })

  afterEach(() => {
    window.removeEventListener(TILE_MIGRATING_EVENT, listener)
    listener.mockReset()
    vi.unstubAllGlobals()
  })

  it('dispatches tile-migrating and still shows the snackbar on TILE_MIGRATING', async () => {
    const message = 'This tile is being upgraded. Try again in a few minutes.'
    stubGraphqlErrorResponse('TILE_MIGRATING', message)
    const onError = vi.fn()

    await run(onError)

    expect(listener).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(message)
  })

  it('does not dispatch tile-migrating on other errors', async () => {
    stubGraphqlErrorResponse('FORBIDDEN', 'Forbidden')

    await run(vi.fn())

    expect(listener).not.toHaveBeenCalled()
  })
})
