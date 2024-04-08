import { describe, expect, it } from 'vitest'

import getConditionArgs from '../../common/get-condition-args'

describe('Get condition args', () => {
  it('hides the value field if "is_empty" is chosen', () => {
    const args = getConditionArgs({ usePlaceholders: false })
    expect(args.find((a) => a.key === 'text').hiddenIf).toEqual({
      fieldKey: 'condition',
      op: 'equals',
      fieldValue: 'is_empty',
    })
  })
})
