import { describe, expect, it } from 'vitest'

import apps from '@/apps'
import App from '@/models/app'

import { isUserVisible, lookupStepDefinition } from '../step-definition'

const registryKeys = Object.entries(apps).flatMap(([appKey, app]) =>
  [...(app.triggers ?? []), ...(app.actions ?? [])].map(
    ({ key }) => [appKey, key] as const,
  ),
)

describe('lookupStepDefinition', () => {
  it('permits a visible action', () => {
    const lookup = lookupStepDefinition('postman', 'sendTransactionalEmail')

    expect(lookup).toMatchObject({
      kind: 'permitted',
      definition: { key: 'sendTransactionalEmail' },
    })
  })

  it('permits a visible trigger', () => {
    const lookup = lookupStepDefinition('formsg', 'newSubmission')

    expect(lookup).toMatchObject({
      kind: 'permitted',
      definition: { key: 'newSubmission' },
    })
  })

  it('marks the FormSG MRF submission action hidden', () => {
    const lookup = lookupStepDefinition('formsg', 'mrfSubmission')

    expect(lookup).toMatchObject({
      kind: 'hidden',
      definition: { key: 'mrfSubmission', hiddenFromUser: true },
    })
  })

  it('reports an unknown app', () => {
    expect(lookupStepDefinition('no-such-app', 'newSubmission')).toEqual({
      kind: 'unknown',
    })
  })

  it('reports an unknown key on a known app', () => {
    expect(lookupStepDefinition('formsg', 'noSuchKey')).toEqual({
      kind: 'unknown',
    })
  })

  it.each(registryKeys)(
    'agrees with App.findTriggerOrActionByKey for %s %s',
    async (appKey, key) => {
      const legacy = await App.findTriggerOrActionByKey(appKey, key)
      const lookup = lookupStepDefinition(appKey, key)

      expect(lookup.kind).toBe(legacy.hiddenFromUser ? 'hidden' : 'permitted')
      expect(lookup).toMatchObject({
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
