import type { IJSONObject } from '@plumber/types'

import { LETTERSG_STAGING_LABEL_SUFFIX } from '../common/api'

export default function getEditableConnectionLabel(
  formattedData?: IJSONObject,
): string {
  const screenName = formattedData?.screenName
  if (typeof screenName !== 'string') {
    return ''
  }

  if (screenName.endsWith(LETTERSG_STAGING_LABEL_SUFFIX)) {
    return screenName.slice(0, -LETTERSG_STAGING_LABEL_SUFFIX.length)
  }

  return screenName
}
