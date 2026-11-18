import { describe, expect, it } from 'vitest'

import BaseExecution from '@/models/execution/base'
import BaseFlowCollaborator from '@/models/flow-collaborators/base'
import BaseFlowTransfer from '@/models/flow-transfers/base'
import BaseFlow from '@/models/flow/base'
import BaseStep from '@/models/step/base'
import BaseUser from '@/models/user/base'

const ALLOWED_STATICS = ['tableName', 'jsonSchema', 'relationMappings']

// Behavior on a base model would silently differ from the full model's hooks and overrides.
describe.each([
  ['BaseExecution', BaseExecution],
  ['BaseFlow', BaseFlow],
  ['BaseFlowCollaborator', BaseFlowCollaborator],
  ['BaseFlowTransfer', BaseFlowTransfer],
  ['BaseStep', BaseStep],
  ['BaseUser', BaseUser],
])('%s', (_name, model) => {
  it('defines no instance members', () => {
    expect(Object.getOwnPropertyNames(model.prototype)).toEqual(['constructor'])
  })

  it('defines only column and relation statics', () => {
    // Objection caches `$$` statics on a class once any query uses it.
    const statics = Object.getOwnPropertyNames(model).filter(
      (name) =>
        !['length', 'name', 'prototype'].includes(name) &&
        !name.startsWith('$$'),
    )
    expect(ALLOWED_STATICS).toEqual(expect.arrayContaining(statics))
  })
})
