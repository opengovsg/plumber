import type { IField, IStep, ISubstep } from '@plumber/types'

import { describe, expect, it, vi } from 'vitest'

// editor.ts transitively imports a React component that pulls in the
// LaunchDarkly React SDK, which has no ESM build resolvable under vitest.
vi.mock('launchdarkly-react-client-sdk', () => ({
  useLDClient: () => undefined,
  withLDProvider: () => (component: unknown) => component,
}))

import { withDefaultParameters } from '../editor'

const RECIPIENT_FIELD: IField = {
  key: 'destinationEmail',
  label: 'Recipient email(s)',
  type: 'string',
  required: true,
  tabs: {
    key: 'sendMode',
    value: 'combined',
    options: [
      { label: 'One email to all', value: 'combined' },
      { label: 'Individual email to each recipient', value: 'individual' },
    ],
  },
} as IField

function makeSubsteps(args: IField[]): ISubstep[] {
  return [{ key: 'setUpAction', name: 'Set up action', arguments: args }]
}

function makeStep(parameters: IStep['parameters']): IStep {
  return { id: 'step-1', createdAt: '1700000000000', parameters } as IStep
}

// No input flag is configured for these fields, so visibility always passes.
const getFlagValue = (() => false) as never

describe('withDefaultParameters', () => {
  it('seeds a tabbed field default under the tab key', () => {
    const result = withDefaultParameters(
      makeStep({}),
      makeSubsteps([RECIPIENT_FIELD]),
      'sendTransactionalEmail',
      getFlagValue,
    )

    expect(result.parameters.sendMode).toEqual('combined')
  })

  it('does not override a tab value the step already has', () => {
    const result = withDefaultParameters(
      makeStep({ sendMode: 'individual' }),
      makeSubsteps([RECIPIENT_FIELD]),
      'sendTransactionalEmail',
      getFlagValue,
    )

    expect(result.parameters.sendMode).toEqual('individual')
  })

  it('seeds the tab key even though the field itself has no static value', () => {
    const result = withDefaultParameters(
      makeStep({}),
      makeSubsteps([RECIPIENT_FIELD]),
      'sendTransactionalEmail',
      getFlagValue,
    )

    expect(result.parameters.destinationEmail).toBeUndefined()
    expect(result.parameters.sendMode).toEqual('combined')
  })

  it('still seeds a plain field value', () => {
    const result = withDefaultParameters(
      makeStep({}),
      makeSubsteps([
        { key: 'notify', type: 'boolean-radio', value: false } as IField,
      ]),
      'someAction',
      getFlagValue,
    )

    expect(result.parameters.notify).toEqual(false)
  })

  it('returns the same step when there is nothing to seed', () => {
    const step = makeStep({ subject: 'hello' })
    const result = withDefaultParameters(
      step,
      makeSubsteps([{ key: 'subject', type: 'string' } as IField]),
      'someAction',
      getFlagValue,
    )

    expect(result).toBe(step)
  })
})
