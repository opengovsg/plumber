import { describe, expect, it } from 'vitest'

import { flattenNestedSteps } from '../create-flow-with-steps'

describe('flattenNestedSteps', () => {
  it('numbers steps depth-first and records each If block extent', () => {
    const result = flattenNestedSteps([
      { appKey: 'formsg', key: 'newSubmission' },
      {
        appKey: 'toolbox',
        key: 'ifThen',
        parameters: { branchName: 'Urgent' },
        steps: [
          { appKey: 'slack', key: 'sendMessageToChannel' },
          { appKey: 'postman-sms', key: 'sendSms' },
        ],
      },
      { appKey: 'postman', key: 'sendTransactionalEmail' },
      {
        appKey: 'toolbox',
        key: 'ifThen',
        steps: [{ appKey: 'telegram-bot', key: 'sendMessage' }],
      },
    ])

    expect(result).toStrictEqual([
      { appKey: 'formsg', key: 'newSubmission', type: 'trigger', position: 1 },
      {
        appKey: 'toolbox',
        key: 'ifThen',
        parameters: { branchName: 'Urgent' },
        type: 'action',
        position: 2,
        ifThenChildCount: 2,
      },
      {
        appKey: 'slack',
        key: 'sendMessageToChannel',
        type: 'action',
        position: 3,
      },
      { appKey: 'postman-sms', key: 'sendSms', type: 'action', position: 4 },
      {
        appKey: 'postman',
        key: 'sendTransactionalEmail',
        type: 'action',
        position: 5,
      },
      {
        appKey: 'toolbox',
        key: 'ifThen',
        type: 'action',
        position: 6,
        ifThenChildCount: 1,
      },
      {
        appKey: 'telegram-bot',
        key: 'sendMessage',
        type: 'action',
        position: 7,
      },
    ])
  })

  it('leaves an ifThen without nested steps on the derived extent', () => {
    const result = flattenNestedSteps([
      { appKey: 'formsg', key: 'newSubmission' },
      { appKey: 'toolbox', key: 'ifThen' },
      { appKey: 'postman', key: 'sendTransactionalEmail' },
    ])
    expect(result[1]).toStrictEqual({
      appKey: 'toolbox',
      key: 'ifThen',
      type: 'action',
      position: 2,
    })
  })

  it('rejects nested steps on a step that is not an ifThen', () => {
    expect(() =>
      flattenNestedSteps([
        { appKey: 'formsg', key: 'newSubmission' },
        {
          appKey: 'toolbox',
          key: 'forEach',
          steps: [{ appKey: 'postman', key: 'sendTransactionalEmail' }],
        },
      ]),
    ).toThrow('Only toolbox/ifThen steps can contain nested steps')
  })

  it('rejects an ifThen with an empty steps array', () => {
    expect(() =>
      flattenNestedSteps([
        { appKey: 'formsg', key: 'newSubmission' },
        { appKey: 'toolbox', key: 'ifThen', steps: [] },
      ]),
    ).toThrow('An If block must contain at least one step.')
  })
})
