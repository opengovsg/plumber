import { describe, expect, it } from 'vitest'

import apps from '@/apps'
import App from '@/models/app'

import { isUserVisible, lookupStepDefinition } from '../step-definition'

const registryKeys = Object.entries(apps).flatMap(([appKey, app]) => [
  ...(app.triggers ?? []).map(({ key }) => [appKey, key, 'trigger'] as const),
  ...(app.actions ?? []).map(({ key }) => [appKey, key, 'action'] as const),
])

describe('lookupStepDefinition', () => {
  it('permits a visible action', () => {
    expect(
      lookupStepDefinition('postman', 'sendTransactionalEmail', 'action'),
    ).toMatchObject({
      kind: 'permitted',
      type: 'action',
      definition: { key: 'sendTransactionalEmail' },
    })
  })

  it('permits a visible trigger', () => {
    expect(
      lookupStepDefinition('formsg', 'newSubmission', 'trigger'),
    ).toMatchObject({
      kind: 'permitted',
      type: 'trigger',
      definition: { key: 'newSubmission' },
    })
  })

  it('marks the FormSG MRF submission action hidden', () => {
    expect(
      lookupStepDefinition('formsg', 'mrfSubmission', 'action'),
    ).toMatchObject({
      kind: 'hidden',
      type: 'action',
      definition: { key: 'mrfSubmission', hiddenFromUser: true },
    })
  })

  it.each([
    ['an unknown app', 'no-such-app', 'newSubmission', 'trigger'],
    ['an unknown key', 'formsg', 'noSuchKey', 'action'],
    [
      'a trigger key looked up as an action',
      'formsg',
      'newSubmission',
      'action',
    ],
    [
      'an action key looked up as a trigger',
      'formsg',
      'mrfSubmission',
      'trigger',
    ],
  ] as const)('reports %s as unknown', (_, appKey, key, type) => {
    expect(lookupStepDefinition(appKey, key, type)).toEqual({ kind: 'unknown' })
  })

  it.each(registryKeys)(
    'agrees with App.findTriggerOrActionByKey for %s %s (%s)',
    async (appKey, key, type) => {
      const legacy = await App.findTriggerOrActionByKey(appKey, key)
      const lookup = lookupStepDefinition(appKey, key, type)

      expect(lookup.kind).toBe(legacy.hiddenFromUser ? 'hidden' : 'permitted')
      expect(lookup).toMatchObject({
        type,
        definition: {
          key: legacy.key,
          name: legacy.name,
          description: legacy.description,
        },
      })
    },
  )
})

describe('isUserVisible', () => {
  it('hides only definitions flagged hiddenFromUser', () => {
    expect(isUserVisible({ hiddenFromUser: true })).toBe(false)
    expect(isUserVisible({ hiddenFromUser: false })).toBe(true)
    expect(isUserVisible({})).toBe(true)
  })
})
