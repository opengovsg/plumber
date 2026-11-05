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
  it('drops an action when its flag is false', () => {
    const actions = getSelectableActions(slack, (flag) => {
      return flag !== 'app_slack_action_findMessage'
    })

    expect(actions.map((action) => action.key)).toEqual([
      'sendMessageToChannel',
    ])
  })

  it('keeps an action when its flag is missing', () => {
    const actions = getSelectableActions(slack, (_flag, fallback) => fallback)

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
