import { existsSync } from 'node:fs'

import type { LDOptions } from '@launchdarkly/node-server-sdk'
import { FileDataSourceFactory } from '@launchdarkly/node-server-sdk/integrations'

import type { AppConfig } from '@/config/app'

export function getLdClientOptions(
  config: Pick<AppConfig, 'launchDarklyOffline' | 'launchDarklyFlagFile'>,
): LDOptions {
  if (config.launchDarklyOffline !== true) {
    return {}
  }
  // IMPORTANT: a missing file fails client init, which would break every flag read.
  if (
    !config.launchDarklyFlagFile ||
    !existsSync(config.launchDarklyFlagFile)
  ) {
    return { offline: true }
  }
  return {
    updateProcessor: new FileDataSourceFactory({
      paths: [config.launchDarklyFlagFile],
      autoUpdate: true,
    }).getFactory(),
    sendEvents: false,
    diagnosticOptOut: true,
  }
}
