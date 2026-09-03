import type { Request } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readGraphqlRootFields: vi.fn(),
  redactGraphqlVariables: vi.fn(),
}))

vi.mock('@/helpers/redaction/graphql-root-fields', () => ({
  readGraphqlRootFields: mocks.readGraphqlRootFields,
}))

vi.mock('@/helpers/redaction/redact-graphql-variables', () => ({
  redactGraphqlVariables: mocks.redactGraphqlVariables,
}))

import { getGraphqlVariables } from '../morgan'

const request = (body: Record<string, unknown>) => ({ body } as Request)

describe('getGraphqlVariables', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.readGraphqlRootFields.mockReturnValue(['updateStep'])
    mocks.redactGraphqlVariables.mockImplementation(
      (_rootFields, variables) => variables,
    )
  })

  it('returns undefined when the request carries no variables', () => {
    expect(
      getGraphqlVariables(request({ query: 'mutation Foo { foo }' })),
    ).toBe(undefined)
    expect(mocks.redactGraphqlVariables).not.toHaveBeenCalled()
  })

  it('hands the stamped root fields and the variables to the dispatcher', () => {
    const variables = { input: { id: 'step-1' } }
    const req = request({ variables })

    getGraphqlVariables(req)

    expect(mocks.readGraphqlRootFields).toHaveBeenCalledWith(req)
    expect(mocks.redactGraphqlVariables).toHaveBeenCalledWith(
      ['updateStep'],
      variables,
    )
  })

  it('logs the redacted variables with single quotes', () => {
    mocks.redactGraphqlVariables.mockReturnValue({ input: { id: 'step-1' } })

    expect(getGraphqlVariables(request({ variables: {} }))).toBe(
      "{'input':{'id':'step-1'}}",
    )
  })

  it('logs a blanked blob bare, without wrapping quotes', () => {
    mocks.redactGraphqlVariables.mockReturnValue('[redacted]')

    expect(getGraphqlVariables(request({ variables: {} }))).toBe('[redacted]')
  })
})
