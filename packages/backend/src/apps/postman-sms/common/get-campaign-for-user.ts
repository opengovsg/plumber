import type { IJSONObject } from '@plumber/types'

import { AES, enc } from 'crypto-js'
import { memoize } from 'lodash'

import appConfig from '@/config/app'
import AppMetadata from '@/models/app-metadata'

import { APP_KEY } from './constants'

interface RawCampaignInfo extends IJSONObject {
  campaignId: string
  agencyDomains: string[]
  apiKey: string // Encrypted in DB
}

type CampaignInfo = Pick<RawCampaignInfo, 'campaignId' | 'apiKey'>
type CampaignInfoMap = Record<string, CampaignInfo>

// We memoize this because this function will be called bunch of times:
// 1. Within send SMS action, to determine the campaign ID.
// 2. Within beforeRequest, to add API key to the auth header.
// 3. Within getGroupConfigForJob, to set campaign ID as the bullMQ group ID.
//
// Adding new campaigns / agencies should be rare, so for now, doing these will
// require a re-deploy (because invalidating all worker caches will add a lot
// complexity than needed).
const getCampaignInfoMap = memoize(async () => {
  const rawCampaigns = await AppMetadata.getAppMetadata<RawCampaignInfo>(
    APP_KEY,
    'campaign_info',
  )

  const result: CampaignInfoMap = Object.create(null)
  for (const { agencyDomains, campaignId, apiKey } of rawCampaigns) {
    for (const agencyDomain of agencyDomains) {
      result[agencyDomain] = {
        campaignId,
        apiKey: AES.decrypt(apiKey, appConfig.encryptionKey).toString(enc.Utf8),
      }
    }
  }
  return Object.freeze(result)
})

export async function getCampaignForUser(
  userEmail: string,
): Promise<CampaignInfo | null> {
  const campaignInfoMap = await getCampaignInfoMap()

  // Email is guaranteed to be valid here, so safe to extract domain by
  // splitting.
  const domain = userEmail.split('@')[1]

  return campaignInfoMap[domain] ?? null
}
