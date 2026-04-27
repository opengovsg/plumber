import StepError from '@/errors/step'

export function throwAisayDeprecationError() {
  throw new StepError(
    'AISAY is deprecated',
    'Use the "Pair - Process an image" action instead.',
  )
}
