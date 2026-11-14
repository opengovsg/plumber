import StepError from '@/errors/step'

export function throwAisayDeprecationError() {
  throw new StepError({
    name: 'AISAY is deprecated',
    solution: 'Use the "Pair - Process an image" action instead.',
    kind: 'config',
  })
}
