import { IJSONObject } from '@plumber/types'

import delayForAsMilliseconds, {
  TDelayForUnit,
} from './delay-for-as-milliseconds'
import delayUntilAsMilliseconds from './delay-until-as-milliseconds'

const delayAsMilliseconds = (stepKey: string, dataOut: IJSONObject) => {
  let delayDuration = 0

  if (stepKey === 'delayFor') {
    const { delayForUnit, delayForValue } = dataOut
    delayDuration = delayForAsMilliseconds(
      delayForUnit as TDelayForUnit,
      Number(delayForValue),
    )
  } else if (stepKey === 'delayUntil') {
    const { delayUntil, delayUntilTime } = dataOut
    delayDuration = delayUntilAsMilliseconds(
      delayUntil as string,
      delayUntilTime as string,
    )
  }

  return delayDuration
}

export default delayAsMilliseconds
