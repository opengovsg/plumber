import { describe, expect, it } from 'vitest'

import BaseExecution from '@/models/execution/base'
import BaseFlow from '@/models/flow/base'
import BaseStep from '@/models/step/base'

const ALLOWED_STATICS = ['tableName', 'jsonSchema', 'relationMappings']

// Behavior on a base model would silently differ from the full model's hooks and overrides.
describe.each([
  ['BaseExecution', BaseExecution],
  ['BaseFlow', BaseFlow],
  ['BaseStep', BaseStep],
])('%s', (_name, model) => {
  it('defines no instance members', () => {
    expect(Object.getOwnPropertyNames(model.prototype)).toEqual(['constructor'])
  })

  it('defines only column and relation statics', () => {
    const statics = Object.getOwnPropertyNames(model).filter(
      (name) => !['length', 'name', 'prototype'].includes(name),
    )
    expect(ALLOWED_STATICS).toEqual(expect.arrayContaining(statics))
  })
})
