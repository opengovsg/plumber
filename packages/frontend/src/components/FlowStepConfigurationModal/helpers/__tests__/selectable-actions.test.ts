import type { IApp } from '@plumber/types'
import { describe, expect, it } from 'vitest'

import { getSelectableActions } from '../selectable-actions'

const slack = {
  key: 'slack',
  actions: [
    { key: 'findMessage', name: 'Find a message' },
    { key: 'sendMessageToChannel', name: 'Send a message to a channel' },
  ],
} as IApp

describe('getSelectableActions', () => {
  it('drops Find a message when the flag is off', () => {
    const actions = getSelectableActions(slack, (_flag, fallback) => fallback)

    expect(actions.map((action) => action.key)).toEqual([
      'sendMessageToChannel',
    ])
  })

  it('keeps Find a message when the flag is on', () => {
    const actions = getSelectableActions(slack, () => true)

    expect(actions.map((action) => action.key)).toEqual([
      'findMessage',
      'sendMessageToChannel',
    ])
  })

  it('drops actions hidden from users', () => {
    const app = {
      key: 'formsg',
      actions: [
        { key: 'mrfSubmission', hiddenFromUser: true },
        { key: 'other', hiddenFromUser: false },
      ],
    } as IApp

    const actions = getSelectableActions(app, () => true)

    expect(actions.map((action) => action.key)).toEqual(['other'])
  })
})
