import { IStep } from '@plumber/types'

const allowAddStep = (branchSteps: IStep[]) => {
  return (
    branchSteps.length >= 2 &&
    branchSteps.every((step) => step.key && step.appKey)
  )
}

export { allowAddStep }
