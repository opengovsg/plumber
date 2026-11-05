import { randomUUID } from 'crypto'

import { describe, expect, it } from 'vitest'

import { TEMPLATES } from '@/db/storage'

import { convertFlowToTemplate } from '../convert-flow-to-template'
import { templateSchema } from '../template-schema'

describe('templateSchema', () => {
  it.each(TEMPLATES.map((template) => [template.name, template]))(
    'accepts the built-in "%s" template',
    (_name, template) => {
      expect(templateSchema.safeParse(template).error).toBeUndefined()
    },
  )

  it('accepts a template converted from a flow', () => {
    const template = convertFlowToTemplate(
      {
        name: 'Flow',
        steps: [
          {
            id: randomUUID(),
            position: 1,
            appKey: 'formsg',
            key: 'newSubmission',
            parameters: {},
          },
        ],
      },
      { id: randomUUID(), description: '' },
    )

    expect(templateSchema.safeParse(template).error).toBeUndefined()
  })

  it('preserves step config and defaults missing config to an empty object', () => {
    const template = templateSchema.parse({
      id: randomUUID(),
      name: 'Configured flow',
      description: '',
      steps: [
        { position: 1, appKey: 'webhook', eventKey: 'catchRawWebhook' },
        {
          position: 2,
          appKey: 'custom-api',
          eventKey: 'httpRequest',
          config: {
            stepName: 'Custom request',
            adminOverride: { customApiTimeout: 60000 },
          },
        },
      ],
    })

    expect(template.steps[0].config).toEqual({})
    expect(template.steps[1].config).toEqual({
      stepName: 'Custom request',
      adminOverride: { customApiTimeout: 60000 },
    })
  })

  it('rejects a step without a position', () => {
    const result = templateSchema.safeParse({
      id: randomUUID(),
      name: 'Bad',
      description: '',
      steps: [{ appKey: 'formsg' }],
    })

    expect(result.success).toBe(false)
  })

  const parseStep = (step: Record<string, unknown>) =>
    templateSchema.safeParse({
      id: randomUUID(),
      name: 'Template',
      description: '',
      steps: [{ position: 2, ...step }],
    })

  it('accepts template data on an app event with a handler', () => {
    const result = parseStep({
      appKey: 'tiles',
      eventKey: 'createTileRow',
      templateData: { name: 'Table', columns: ['Email'] },
    })

    expect(result.error).toBeUndefined()
  })

  it('rejects template data on an app event without a handler', () => {
    const result = parseStep({
      appKey: 'postman',
      eventKey: 'sendTransactionalEmail',
      templateData: { name: 'Table', columns: ['Email'] },
    })

    expect(result.error?.issues[0].path).toEqual(['steps', 0, 'templateData'])
  })

  it('rejects template data the handler schema rejects', () => {
    const result = parseStep({
      appKey: 'tiles',
      eventKey: 'createTileRow',
      templateData: { name: 'Table', columns: 'Email' },
    })

    expect(result.error?.issues[0].path).toEqual([
      'steps',
      0,
      'templateData',
      'columns',
    ])
  })
})
