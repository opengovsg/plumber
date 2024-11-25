import { assert, describe, expect, it } from 'vitest'

import { server } from '../graphql-instance'

describe('GraphQL instance', () => {
  describe('Batching within an operation', () => {
    it('should not throw an error if a single root fields is present', async () => {
      const result = await server.executeOperation({
        query: `query HealthCheck { healthcheck { version } }`,
      })
      assert(result.body.kind === 'single')
      expect(result.body.singleResult.errors).toBeUndefined()
    })

    it('should throw an error if multiple root fields are present', async () => {
      const result = await server.executeOperation({
        query: `query TwoHealthChecks { h1: healthcheck { version } h2: healthcheck { version } }`,
      })
      assert(result.body.kind === 'single')
      expect(result.body.singleResult.errors[0]).toHaveProperty(
        'code',
        'BAD_USER_INPUT',
      )
    })
  })
})
