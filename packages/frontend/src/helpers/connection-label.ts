const POSTMAN_TEST_LABEL_PREFIX = '[TEST] '
const LETTERSG_STAGING_LABEL_SUFFIX = ' [STAGING]'

export function getEditableConnectionLabel(
  appKey: string,
  screenName?: string | null,
): string {
  if (!screenName) {
    return ''
  }

  if (
    appKey === 'postman-sms' &&
    screenName.startsWith(POSTMAN_TEST_LABEL_PREFIX)
  ) {
    return screenName.slice(POSTMAN_TEST_LABEL_PREFIX.length)
  }

  if (
    appKey === 'lettersg' &&
    screenName.endsWith(LETTERSG_STAGING_LABEL_SUFFIX)
  ) {
    return screenName.slice(0, -LETTERSG_STAGING_LABEL_SUFFIX.length)
  }

  return screenName
}

export function getConnectionEnvLabel(env?: string | null): string | null {
  if (env === 'test') {
    return 'Staging'
  }

  if (env === 'live') {
    return 'Production'
  }

  return null
}
