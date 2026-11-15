import { describe, expect, it } from 'vitest'

import { databricksWorkspaceUrl } from './databricks-workspace-url' // pragma: allowlist secret

const ENV = JSON.stringify({
  hostname: 'example.cloud.databricks.com',
  catalog: 'main',
})

describe('databricksWorkspaceUrl', () => { // pragma: allowlist secret
  it('uses screenName for the last path segment', () => {
    const screenName = 'user_example_com'

    const url = databricksWorkspaceUrl(screenName, ENV) // pragma: allowlist secret

    expect(url).toBe(
      'https://example.cloud.databricks.com/explore/data/main/user_example_com',
    )
    expect(url?.split('/').at(-1)).toBe(screenName)
  })

  it('returns null when env is empty', () => {
    expect(databricksWorkspaceUrl('user_example_com', '')).toBeNull() // pragma: allowlist secret
    expect(databricksWorkspaceUrl('user_example_com', null)).toBeNull() // pragma: allowlist secret
    expect(databricksWorkspaceUrl('user_example_com', undefined)).toBeNull() // pragma: allowlist secret
  })

  it('returns null when env is not JSON', () => {
    expect(databricksWorkspaceUrl('user_example_com', '{')).toBeNull() // pragma: allowlist secret
  })

  it('returns null when hostname or catalog is missing', () => {
    expect(
      databricksWorkspaceUrl( // pragma: allowlist secret
        'user_example_com',
        JSON.stringify({ hostname: 'example.cloud.databricks.com' }),
      ),
    ).toBeNull()
    expect(
      databricksWorkspaceUrl( // pragma: allowlist secret
        'user_example_com',
        JSON.stringify({ catalog: 'main' }),
      ),
    ).toBeNull()
  })

  it('returns null when hostname or catalog is not a string', () => {
    expect(
      databricksWorkspaceUrl( // pragma: allowlist secret
        'user_example_com',
        JSON.stringify({ hostname: 123, catalog: 'main' }),
      ),
    ).toBeNull()
    expect(
      databricksWorkspaceUrl( // pragma: allowlist secret
        'user_example_com',
        JSON.stringify({
          hostname: 'example.cloud.databricks.com',
          catalog: 1,
        }),
      ),
    ).toBeNull()
  })
})
