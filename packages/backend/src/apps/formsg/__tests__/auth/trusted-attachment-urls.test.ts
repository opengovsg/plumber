import { describe, expect, it } from 'vitest'

import { areAttachmentUrlsTrusted } from '../../auth/trusted-attachment-urls'

const TRUSTED_URL =
  'https://s3.ap-southeast-1.amazonaws.com/attachments.form.gov.sg/6878bfa1f4c0afec0b00d66c/3717b2ffb126e8d78c78acd3c0742939f03ea0e3/123'

describe('areAttachmentUrlsTrusted', () => {
  it('accepts an empty map', () => {
    expect(areAttachmentUrlsTrusted({})).toBe(true)
  })

  it('accepts FormSG bucket URLs', () => {
    expect(
      areAttachmentUrlsTrusted({
        attachField1: TRUSTED_URL,
        attachField2: `${TRUSTED_URL}?X-Amz-Signature=abc`,
      }),
    ).toBe(true)
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
    expect(areAttachmentUrlsTrusted({ attachField1: untrustedUrl })).toBe(false)
  })

  it('rejects the whole map when only one URL is untrusted', () => {
    expect(
      areAttachmentUrlsTrusted({
        attachField1: TRUSTED_URL,
        attachField2: 'https://plumber.svc.cluster.local/a',
      }),
    ).toBe(false)
  })
})
