import { TBeforeRequest } from '@plumber/types'

import https from 'https'

// Singleton HTTPS agent configured for IPv4 only
// This helps avoid DNS timeout issues with Telegram's API
const httpsAgent = new https.Agent({
  family: 4, // Force IPv4 resolution
  keepAlive: true,
  timeout: 30000, // 30 second timeout
})

const forceIpv4: TBeforeRequest = async ($, requestConfig) => {
  // Only apply to HTTPS requests (Telegram API uses HTTPS)
  if (requestConfig.baseURL?.startsWith('https://')) {
    requestConfig.httpsAgent = httpsAgent
  }

  return requestConfig
}

export default forceIpv4
