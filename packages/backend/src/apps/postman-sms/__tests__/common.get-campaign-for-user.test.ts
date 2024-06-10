import { afterEach, describe, expect, it, vi } from 'vitest'

import { getCampaignForUser } from '../common/get-campaign-for-user'

const mocks = vi.hoisted(() => ({
  getAppMetadata: vi.fn(() => [
    {
      campaignId: 'coffee-campaign-id',
      agencyDomains: ['kopi.local', 'coffee.local'],
      apiKey: 'COFFEE-KEY',
    },
    {
      campaignId: 'ogp-campaign-id',
      agencyDomains: ['ogp-one.local', 'ogp-two.local'],
      apiKey: 'OGP-KEY',
    },
  ]),
}))

vi.mock('crypto-js', () => ({
  AES: {
    decrypt: vi.fn((ciphertext: string) => ({
      toString: vi.fn(() => ciphertext.toLowerCase()),
    })),
  },
  enc: {
    Utf8: {},
  },
}))

vi.mock('@/models/app-metadata', () => ({
  default: {
    getAppMetadata: mocks.getAppMetadata,
  },
}))

describe('Get campaign for user', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    {
      userEmail: 'user@kopi.local',
      expectedCampaignId: 'coffee-campaign-id',
      expecetedApiKey: 'coffee-key',
    },
    {
      userEmail: 'user@coffee.local',
      expectedCampaignId: 'coffee-campaign-id',
      expecetedApiKey: 'coffee-key',
    },
    {
      userEmail: 'user@ogp-one.local',
      expectedCampaignId: 'ogp-campaign-id',
      expecetedApiKey: 'ogp-key',
    },
  ])(
    "returns the campaign ID and key corresponding to the user's agency",
    async ({ userEmail, expectedCampaignId, expecetedApiKey }) => {
      const { campaignId, apiKey } = await getCampaignForUser(userEmail)
      expect(campaignId).toEqual(expectedCampaignId)
      expect(apiKey).toEqual(expecetedApiKey)
    },
  )

  it("returns null if a campaign could not be found for the user's agency", async () => {
    const result = await getCampaignForUser('user@tea.local')
    expect(result).toBeNull()
  })
})
