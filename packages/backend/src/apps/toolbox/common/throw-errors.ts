import StepError from '@/errors/step'

export function throwInvalidConditionError(
  errorName: string,
  position: number,
  appName: string,
) {
  let stepErrorSolution = ''
  if (errorName.includes('every')) {
    // ifThen has an additional error to catch: no conditions configured
    stepErrorSolution =
      'Click on set up action and check that the condition has been configured properly.'
  } else {
    stepErrorSolution =
      'Click on set up action and check that one of valid options in the condition dropdown is being selected.'
  }
  throw new StepError(errorName, stepErrorSolution, position, appName)
}
