import { describe, expect, it } from 'vitest'

import { databricksExploreUrl } from '../databricks-explore-url'

const ENV = JSON.stringify({
  hostname: 'example.cloud.databricks.com',
  catalog: 'main',
})

describe('databricksExploreUrl', () => {
  it('uses screenName for the last path segment', () => {
    const screenName = 'user_example_com'

    const url = databricksExploreUrl(screenName, ENV)

    expect(url).toBe(
      'https://example.cloud.databricks.com/explore/data/main/user_example_com',
    )
    expect(url?.split('/').at(-1)).toBe(screenName)
  })

  it('returns null when env is empty', () => {
    expect(databricksExploreUrl('user_example_com', '')).toBeNull()
    expect(databricksExploreUrl('user_example_com', undefined)).toBeNull()
  })

  it('returns null when env is not JSON', () => {
    expect(databricksExploreUrl('user_example_com', '{')).toBeNull()
  })

  it('returns null when hostname or catalog is missing', () => {
    expect(
      databricksExploreUrl(
        'user_example_com',
        JSON.stringify({ hostname: 'example.cloud.databricks.com' }),
      ),
    ).toBeNull()
    expect(
      databricksExploreUrl(
        'user_example_com',
        JSON.stringify({ catalog: 'main' }),
      ),
    ).toBeNull()
  })

  it('returns null when hostname or catalog is not a string', () => {
    expect(
      databricksExploreUrl(
        'user_example_com',
        JSON.stringify({ hostname: 123, catalog: 'main' }),
      ),
    ).toBeNull()
    expect(
      databricksExploreUrl(
        'user_example_com',
        JSON.stringify({
          hostname: 'example.cloud.databricks.com',
          catalog: 1,
        }),
      ),
    ).toBeNull()
  })

  it('returns null when hostname carries a path, query or userinfo', () => {
    for (const hostname of [
      'evil.example.com/x',
      'evil.example.com?x=1',
      'user@evil.example.com',
    ]) {
      expect(
        databricksExploreUrl(
          'user_example_com',
          JSON.stringify({ hostname, catalog: 'main' }),
        ),
      ).toBeNull()
    }
  })

  it('encodes catalog and screenName as single path segments', () => {
    const url = databricksExploreUrl(
      'a/b',
      JSON.stringify({
        hostname: 'example.cloud.databricks.com',
        catalog: 'c?d',
      }),
    )

    expect(url).toBe(
      'https://example.cloud.databricks.com/explore/data/c%3Fd/a%2Fb',
    )
  })
})
