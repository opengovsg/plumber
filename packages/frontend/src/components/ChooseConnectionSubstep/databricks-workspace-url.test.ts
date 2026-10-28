import { describe, expect, it } from 'vitest'

import {
  databricksWorkspaceUrl as buildExploreUrl, // pragma: allowlist secret
} from './databricks-workspace-url' // pragma: allowlist secret

const ENV = JSON.stringify({
  hostname: 'example.cloud.databricks.com',
  catalog: 'main',
})

describe('explore url', () => {
  it('uses screenName for the last path segment and leaves a deprecated label out of the URL', () => {
    const label = '[DEPRECATED] user_example_com'
    const screenName = 'user_example_com'

    const url = buildExploreUrl(screenName, ENV)

    expect(url).toBe(
      'https://example.cloud.databricks.com/explore/data/main/user_example_com',
    )
    expect(url?.split('/').at(-1)).toBe(screenName)
    expect(url?.includes(label)).toBe(false)
  })

  it('returns null when env is empty', () => {
    expect(buildExploreUrl('user_example_com', '')).toBeNull()
    expect(buildExploreUrl('user_example_com', null)).toBeNull()
    expect(buildExploreUrl('user_example_com', undefined)).toBeNull()
  })

  it('returns null when env is not JSON', () => {
    expect(buildExploreUrl('user_example_com', '{')).toBeNull()
  })

  it('returns null when hostname or catalog is missing', () => {
    expect(
      buildExploreUrl(
        'user_example_com',
        JSON.stringify({ hostname: 'example.cloud.databricks.com' }),
      ),
    ).toBeNull()
    expect(
      buildExploreUrl('user_example_com', JSON.stringify({ catalog: 'main' })),
    ).toBeNull()
  })
})
