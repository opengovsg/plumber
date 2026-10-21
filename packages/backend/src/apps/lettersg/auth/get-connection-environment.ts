import type { IConnectionEnvironment, IJSONObject } from '@plumber/types'

import { LetterSgEnvironment } from '../common/api'

export default function getConnectionEnvironment(
  formattedData?: IJSONObject,
): IConnectionEnvironment | null {
  if (formattedData?.env === LetterSgEnvironment.Staging) {
    return { id: LetterSgEnvironment.Staging, label: 'Staging' }
  }

  if (formattedData?.env === LetterSgEnvironment.Prod) {
    return { id: LetterSgEnvironment.Prod, label: 'Production' }
  }

  return null
}
