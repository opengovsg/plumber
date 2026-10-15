/**
 * Business rules:
 * 1. In non-dev environments, we will use IAM roles to invoke the model.
 * 2. In local dev, it will pull the API key from the 1pw integration - `with-op-env.mjs`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createBedrockAnthropic: vi.fn((_settings: unknown) => vi.fn(() => ({}))),
  fromNodeProviderChain: vi.fn(() => 'task-role-credential-provider'),
  appConfig: {
    isDev: false,
    bedrock: {
      region: 'ap-southeast-1',
      model: 'test-model',
      imageModel: 'test-image-model',
      devApiKey: 'dev-api-key-from-1password' as string | undefined,
    },
  },
}))

vi.mock('@ai-sdk/amazon-bedrock/anthropic', () => ({
  createBedrockAnthropic: mocks.createBedrockAnthropic,
}))

vi.mock('@aws-sdk/credential-providers', () => ({
  fromNodeProviderChain: mocks.fromNodeProviderChain,
}))

vi.mock('@/config/app', () => ({ default: mocks.appConfig }))

async function loadProviderSettings(isDev: boolean): Promise<unknown> {
  mocks.appConfig.isDev = isDev
  vi.resetModules()
  await import('../pair')
  return mocks.createBedrockAnthropic.mock.calls[0][0]
}

describe('Bedrock auth', () => {
  beforeEach(() => {
    mocks.createBedrockAnthropic.mockClear()
  })

  it('signs requests with the ECS task role in non-dev environments', async () => {
    expect(await loadProviderSettings(false)).toEqual({
      region: 'ap-southeast-1',
      apiKey: '',
      credentialProvider: 'task-role-credential-provider',
    })
  })

  it('uses the BEDROCK_API_KEY from 1Password in local dev', async () => {
    expect(await loadProviderSettings(true)).toEqual({
      region: 'ap-southeast-1',
      apiKey: 'dev-api-key-from-1password',
    })
  })
})
