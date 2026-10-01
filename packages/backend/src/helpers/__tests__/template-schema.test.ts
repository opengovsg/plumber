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

  it('rejects a step without a position', () => {
    const result = templateSchema.safeParse({
      id: randomUUID(),
      name: 'Bad',
      description: '',
      steps: [{ appKey: 'formsg' }],
    })

    expect(result.success).toBe(false)
  })
})
