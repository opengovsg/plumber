import { describe, expect, it } from 'vitest'

import { areAttachmentUrlsTrusted } from '../../auth/trusted-attachment-urls'

const TRUSTED_PROD_URL =
  'https://s3.ap-southeast-1.amazonaws.com/attachments.form.gov.sg/6878bfa1f4c0afec0b00d66c/3717b2ffb126e8d78c78acd3c0742939f03ea0e3/123'
const TRUSTED_STAGING_URL =
  'https://s3.ap-southeast-1.amazonaws.com/attachments.staging.form.gov.sg/6878bfa1f4c0afec0b00d66c/3717b2ffb126e8d78c78acd3c0742939f03ea0e3/123'
const TRUSTED_UAT_URL =
  'https://s3.ap-southeast-1.amazonaws.com/attachments.uat.form.gov.sg/6878bfa1f4c0afec0b00d66c/3717b2ffb126e8d78c78acd3c0742939f03ea0e3/123'

describe('areAttachmentUrlsTrusted', () => {
  it('accepts an empty map', () => {
    expect(areAttachmentUrlsTrusted({}, 'prod')).toBe(true)
  })

  it('accepts FormSG bucket URLs for the prod env', () => {
    expect(
      areAttachmentUrlsTrusted(
        {
          attachField1: TRUSTED_PROD_URL,
          attachField2: `${TRUSTED_PROD_URL}?X-Amz-Signature=abc`,
        },
        'prod',
      ),
    ).toBe(true)
  })

  it('accepts FormSG bucket URLs for the staging env', () => {
    expect(
      areAttachmentUrlsTrusted(
        { attachField1: TRUSTED_STAGING_URL },
        'staging',
      ),
    ).toBe(true)
  })

  it('accepts FormSG bucket URLs for the uat env', () => {
    expect(
      areAttachmentUrlsTrusted({ attachField1: TRUSTED_UAT_URL }, 'uat'),
    ).toBe(true)
  })

  it.each([
    ['a staging URL against the prod env', TRUSTED_STAGING_URL, 'prod'],
    ['a uat URL against the prod env', TRUSTED_UAT_URL, 'prod'],
    ['a prod URL against the staging env', TRUSTED_PROD_URL, 'staging'],
    ['a uat URL against the staging env', TRUSTED_UAT_URL, 'staging'],
    ['a prod URL against the uat env', TRUSTED_PROD_URL, 'uat'],
    ['a staging URL against the uat env', TRUSTED_STAGING_URL, 'uat'],
  ] as const)('rejects %s', (_label, url, formEnv) => {
    expect(areAttachmentUrlsTrusted({ attachField1: url }, formEnv)).toBe(false)
  })

  it.each([
    [
      'plain http',
      'http://s3.ap-southeast-1.amazonaws.com/attachments.form.gov.sg/a',
    ],
    ['the EC2 metadata service', 'http://169.254.169.254/latest/meta-data/'],
    ['an internal host', 'https://plumber.svc.cluster.local/a'],
    [
      'userinfo host confusion',
      'https://s3.ap-southeast-1.amazonaws.com@evil.test/attachments.form.gov.sg/a',
    ],
    [
      'a host suffix match',
      'https://s3.ap-southeast-1.amazonaws.com.evil.test/attachments.form.gov.sg/a',
    ],
    [
      'a non-default port',
      'https://s3.ap-southeast-1.amazonaws.com:8080/attachments.form.gov.sg/a',
    ],
    [
      'another bucket',
      'https://s3.ap-southeast-1.amazonaws.com/other-bucket/a',
    ],
    [
      'traversal out of the bucket',
      'https://s3.ap-southeast-1.amazonaws.com/attachments.form.gov.sg/../other-bucket/a',
    ],
    ['a malformed URL', 'not-a-url'],
    ['an empty string', ''],
  ])('rejects %s', (_label, untrustedUrl) => {
    expect(
      areAttachmentUrlsTrusted({ attachField1: untrustedUrl }, 'prod'),
    ).toBe(false)
  })

  it('rejects the whole map when only one URL is untrusted', () => {
    expect(
      areAttachmentUrlsTrusted(
        {
          attachField1: TRUSTED_PROD_URL,
          attachField2: 'https://plumber.svc.cluster.local/a',
        },
        'prod',
      ),
    ).toBe(false)
  })
})
