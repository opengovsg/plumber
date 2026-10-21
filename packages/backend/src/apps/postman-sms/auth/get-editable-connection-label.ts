import type { IJSONObject } from '@plumber/types'

import { POSTMAN_TEST_LABEL_PREFIX } from '../common/constants'

export default function getEditableConnectionLabel(
  formattedData?: IJSONObject,
): string {
  const screenName = formattedData?.screenName
  if (typeof screenName !== 'string') {
    return ''
  }

  if (screenName.startsWith(POSTMAN_TEST_LABEL_PREFIX)) {
    return screenName.slice(POSTMAN_TEST_LABEL_PREFIX.length)
  }

  return screenName
}
