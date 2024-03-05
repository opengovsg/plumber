import { type IGlobalVariable } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import runPlumberScriptAction from '../../actions/run-plumberscript'

const mocks = vi.hoisted(() => ({
  setActionItem: vi.fn(),
}))

describe('Run PlumberScript', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      flow: {
        id: 'fake-pipe',
      },
      step: {
        id: 'test-step',
        appKey: 'toolbox',
        key: runPlumberScriptAction.key,
        position: 2,
        parameters: {
          script: '',
        },
      },
      app: {
        name: 'Toolbox',
      },
      setActionItem: mocks.setActionItem,
    } as unknown as IGlobalVariable
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exposes script result as a variable', async () => {
    $.step.parameters.script = 'let a = 1; let b = 2; a + b'

    await runPlumberScriptAction.run($)
    expect(mocks.setActionItem).toBeCalledWith({
      raw: { result: '3' },
    })
  })
})
