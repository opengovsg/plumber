import type { IJSONObject } from '@plumber/types'

import { LetterSgEnvironment } from '../common/api'

export default function getConnectionEnvironmentLabel(
  formattedData?: IJSONObject,
): string | null {
  if (formattedData?.env === LetterSgEnvironment.Staging) {
    return 'Staging'
  }

  if (formattedData?.env === LetterSgEnvironment.Prod) {
    return 'Production'
  }

  return null
}
