import { describe, expect, it } from 'vitest'

import { optionGenerator } from './option-generator'

const SCHEMA = 'user_example_com'
const ENV = JSON.stringify({
  hostname: 'example.cloud.databricks.com',
  catalog: 'main',
})

describe('optionGenerator', () => {
  it('prefixes a legacy Databricks connection', () => {
    expect(
      optionGenerator(
        {
          id: 'legacy-id',
          generation: 'legacy',
          description: 'owner schema',
          formattedData: { screenName: SCHEMA, env: ENV },
        },
        'databricks',
      ),
    ).toEqual({
      label: `[DEPRECATED] ${SCHEMA}`,
      value: 'legacy-id',
      description: 'owner schema',
      env: ENV,
    })
  })

  it('prefixes a Databricks connection when generation is missing', () => {
    const prefixed = {
      label: `[DEPRECATED] ${SCHEMA}`,
      value: 'legacy-id',
      description: undefined,
      env: undefined,
    }

    expect(
      optionGenerator(
        {
          id: 'legacy-id',
          formattedData: { screenName: SCHEMA },
        },
        'databricks',
      ),
    ).toEqual(prefixed)
    expect(
      optionGenerator(
        {
          id: 'legacy-id',
          generation: null,
          formattedData: { screenName: SCHEMA },
        },
        'databricks',
      ),
    ).toEqual(prefixed)
  })

  it('leaves a new Databricks connection unprefixed', () => {
    const option = optionGenerator(
      {
        id: 'new-id',
        generation: 'new',
        formattedData: { screenName: SCHEMA, env: ENV },
      },
      'databricks',
    )

    expect(option.label).toBe(SCHEMA)
    expect(option.env).toBe(ENV)
    expect(option.label.includes('[DEPRECATED]')).toBe(false)
  })

  it('leaves a non-Databricks connection unprefixed', () => {
    expect(
      optionGenerator(
        {
          id: 'slack-id',
          generation: 'legacy',
          description: 'channel note',
          formattedData: { screenName: 'Acme', env: 'prod' },
        },
        'slack',
      ),
    ).toEqual({
      label: 'Acme',
      value: 'slack-id',
      description: 'channel note',
      env: 'prod',
    })
  })

  it('keeps the FormSG title parse', () => {
    expect(
      optionGenerator(
        {
          id: 'form-prod',
          formattedData: {
            screenName: '654ab1234abc1a012345f1e0 - Leave application',
          },
        },
        'formsg',
      ),
    ).toEqual({
      label: 'Leave application',
      value: 'form-prod',
      description: '654ab1234abc1a012345f1e0',
      env: 'prod',
    })

    expect(
      optionGenerator(
        {
          id: 'form-staging',
          description: 'shared pipe',
          formattedData: {
            screenName:
              '[STAGING] 654ab1234abc1a012345f1e0 - Leave application',
            env: 'staging',
          },
        },
        'formsg',
      ),
    ).toEqual({
      label: '[STAGING] Leave application',
      value: 'form-staging',
      description: '654ab1234abc1a012345f1e0 - shared pipe',
      env: 'staging',
    })
  })
})
