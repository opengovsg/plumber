import { IJSONObject } from '@plumber/types'

import delayForAsMilliseconds, {
  TDelayForUnit,
} from './delay-for-as-milliseconds'
import delayUntilAsMilliseconds from './delay-until-as-milliseconds'

const delayAsMilliseconds = (
  stepKey: string,
  computedParameters: IJSONObject,
) => {
  let delayDuration = 0

  if (stepKey === 'delayFor') {
    const { delayForUnit, delayForValue } = computedParameters
    delayDuration = delayForAsMilliseconds(
      delayForUnit as TDelayForUnit,
      Number(delayForValue),
    )
  } else if (stepKey === 'delayUntil') {
    const { delayUntil, delayUntilTime = '00:00' } = computedParameters
    delayDuration = delayUntilAsMilliseconds(
      delayUntil as string,
      delayUntilTime as string,
    )
  }

  return delayDuration
}

export default delayAsMilliseconds
