import { type IGlobalVariable } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import toolboxApp from '../..'
import onlyContinueIfAction from '../../actions/only-continue-if'

const mocks = vi.hoisted(() => ({
  setActionItem: vi.fn(),
}))

describe('Only continue if', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      flow: {
        id: 'fake-pipe',
      },
      step: {
        id: 'test-step',
        appKey: toolboxApp.key,
        key: onlyContinueIfAction.key,
        position: 2,
        parameters: {},
      },
      setActionItem: mocks.setActionItem,
    } as unknown as IGlobalVariable
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns void if condition passes', async () => {
    $.step.parameters = {
      field: 1,
      is: 'is',
      condition: 'equals',
      text: 1,
    }

    const result = await onlyContinueIfAction.run($)
    expect(result).toBeFalsy()
    expect(mocks.setActionItem).toBeCalledWith({
      raw: { result: true },
    })
  })

  it('stops execution if condition fails', async () => {
    $.step.parameters = {
      field: 1,
      is: 'is',
      condition: 'equals',
      text: 0,
    }

    const result = await onlyContinueIfAction.run($)
    expect(result).toEqual({
      nextStep: { command: 'stop-execution' },
    })
    expect(mocks.setActionItem).toBeCalledWith({
      raw: { result: false },
    })
  })
})
