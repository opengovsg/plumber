import { type IGlobalVariable } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import runJavaScriptAction from '../../actions/run-javascript'

const mocks = vi.hoisted(() => ({
  setActionItem: vi.fn(),
}))

describe('Run JavaScript', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      flow: {
        id: 'fake-pipe',
      },
      step: {
        id: 'test-step',
        appKey: 'javascript',
        key: runJavaScriptAction.key,
        position: 2,
        parameters: {
          script: '',
        },
      },
      app: {
        name: 'JavaScript',
      },
      setActionItem: mocks.setActionItem,
    } as unknown as IGlobalVariable
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exposes script result as a variable', async () => {
    $.step.parameters.code = 'let a = 1; let b = 2; a + b'

    await runJavaScriptAction.run($)
    expect(mocks.setActionItem).toBeCalledWith({
      raw: { result: '3' },
    })
  })
})
