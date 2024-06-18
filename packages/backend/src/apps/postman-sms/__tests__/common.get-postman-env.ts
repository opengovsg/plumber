import type { IGlobalVariable } from '@plumber/types'

import { beforeEach, describe, expect, it } from 'vitest'

import {
  PostmanEnv,
  PROD_ENV_KEY_PREFIX,
  TEST_ENV_KEY_PREFIX,
} from '../common/constants'
import getPostmanEnv from '../common/get-postman-env'

describe('Get postman env', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      auth: {
        data: {},
      },
    } as unknown as IGlobalVariable
  })

  it.each([
    {
      apiKey: `${PROD_ENV_KEY_PREFIX}test-key`,
      expectedEnv: PostmanEnv.Prod,
    },
    {
      apiKey: `${TEST_ENV_KEY_PREFIX}test-key`,
      expectedEnv: PostmanEnv.Test,
    },
  ])(
    'Returns the env which corresponds to the API key',
    ({ apiKey, expectedEnv }) => {
      $.auth.data.apiKey = apiKey

      expect(getPostmanEnv($)).toEqual(expectedEnv)
    },
  )

  it('throws an error if there is an unrecognized API key', () => {
    $.auth.data.apiKey = 'some_weird_key'
    expect(() => getPostmanEnv($)).toThrow('Unsupported postman environment')
  })
})
