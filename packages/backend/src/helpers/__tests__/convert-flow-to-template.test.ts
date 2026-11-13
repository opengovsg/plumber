import { describe, expect, it } from 'vitest'

import { convertFlowToTemplate } from '../convert-flow-to-template'

const TRIGGER_ID = '11111111-1111-1111-1111-111111111111'
const ACTION_ID = '22222222-2222-2222-2222-222222222222'

describe('convertFlowToTemplate', () => {
  it('converts steps in position order and replaces step ids with placeholders', () => {
    const template = convertFlowToTemplate(
      {
        name: 'My flow',
        steps: [
          {
            id: 'action-3',
            position: 3,
            appKey: 'postman',
            key: 'sendTransactionalEmail',
            parameters: {
              body: `Hi {{step.${TRIGGER_ID}.fields.abc.answer}}, row {{step.${ACTION_ID}.rowId}}`,
              conditions: [{ field: `{{step.${ACTION_ID}.rowsFound}}` }],
            },
          },
          {
            id: TRIGGER_ID,
            position: 1,
            appKey: 'formsg',
            key: 'newSubmission',
            parameters: {},
          },
          {
            id: ACTION_ID,
            position: 2,
            appKey: 'tiles',
            key: 'findSingleRow',
            parameters: { tableId: 'table-1' },
          },
        ],
      },
      { id: 'template-id', description: 'A description' },
    )

    expect(template).toEqual({
      id: 'template-id',
      name: 'My flow',
      description: 'A description',
      steps: [
        {
          position: 1,
          appKey: 'formsg',
          eventKey: 'newSubmission',
          parameters: {},
        },
        {
          position: 2,
          appKey: 'tiles',
          eventKey: 'findSingleRow',
          parameters: { tableId: 'table-1' },
        },
        {
          position: 3,
          appKey: 'postman',
          eventKey: 'sendTransactionalEmail',
          parameters: {
            body: 'Hi {{step.<<step_id_1>>.fields.abc.answer}}, row {{step.<<step_id_2>>.rowId}}',
            conditions: [{ field: '{{step.<<step_id_2>>.rowsFound}}' }],
          },
        },
      ],
    })
  })

  it('copies config without sharing nested objects with the source step', () => {
    const config = {
      stepName: 'Request',
      adminOverride: { customApiTimeout: 60000 },
    }
    const template = convertFlowToTemplate(
      {
        name: 'Flow',
        steps: [
          {
            id: TRIGGER_ID,
            position: 1,
            appKey: 'webhook',
            key: 'catchRawWebhook',
            parameters: {},
            config,
          },
        ],
      },
      { id: 'id', description: '' },
    )

    expect(template.steps[0].config).toEqual(config)
    expect(template.steps[0].config).not.toBe(config)
    expect(template.steps[0].config?.adminOverride).not.toBe(
      config.adminOverride,
    )
  })

  it('drops uploaded s3 attachments', () => {
    const template = convertFlowToTemplate(
      {
        name: 'Flow',
        steps: [
          {
            id: TRIGGER_ID,
            position: 1,
            appKey: 'formsg',
            key: 'newSubmission',
            parameters: {
              attachments: ['s3:bucket/file.pdf', `{{step.${TRIGGER_ID}.x}}`],
            },
          },
        ],
      },
      { id: 'id', description: '' },
    )

    expect(template.steps[0].parameters).toEqual({
      attachments: ['{{step.<<step_id_1>>.x}}'],
    })
  })
})
