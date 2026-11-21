import type { IGlobalVariable } from '@plumber/types'

import { describe, expect, it, vi } from 'vitest'

import runManually from '../../triggers/run-manually'

function makeGlobalVariable() {
  return {
    pushTriggerItem: vi.fn(),
  } as unknown as IGlobalVariable
}

describe('manual trigger: runManually', () => {
  it('declares itself as a non-polling, non-webhook-URL trigger', () => {
    expect(runManually.key).toBe('runManually')
    expect(runManually.type).toBe('webhook')
    // No getInterval means the flow worker will not create a repeatable
    // cron job for this trigger when the pipe is published.
    expect(runManually.getInterval).toBeUndefined()
  })

  it('run() pushes a trigger item with a timestamp and a unique internalId', async () => {
    const $ = makeGlobalVariable()

    await runManually.run?.($)

    expect($.pushTriggerItem).toHaveBeenCalledTimes(1)
    const [dataItem] = ($.pushTriggerItem as ReturnType<typeof vi.fn>).mock
      .calls[0]

    expect(dataItem.raw.triggeredAt).toEqual(expect.any(String))
    expect(dataItem.meta.internalId).toEqual(expect.any(String))
    expect(dataItem.meta.internalId.length).toBeGreaterThan(0)
  })

  it('run() generates a distinct internalId on each invocation, so test runs work in the editor', async () => {
    const $1 = makeGlobalVariable()
    const $2 = makeGlobalVariable()

    await runManually.run?.($1)
    await runManually.run?.($2)

    const id1 = ($1.pushTriggerItem as ReturnType<typeof vi.fn>).mock
      .calls[0][0].meta.internalId
    const id2 = ($2.pushTriggerItem as ReturnType<typeof vi.fn>).mock
      .calls[0][0].meta.internalId

    expect(id1).not.toEqual(id2)
  })

  it('testRun() also pushes a trigger item, for the editor test-step flow', async () => {
    const $ = makeGlobalVariable()

    await runManually.testRun?.($)

    expect($.pushTriggerItem).toHaveBeenCalledTimes(1)
    const [dataItem] = ($.pushTriggerItem as ReturnType<typeof vi.fn>).mock
      .calls[0]
    expect(dataItem.raw.triggeredAt).toEqual(expect.any(String))
    expect(dataItem.meta.internalId).toEqual(expect.any(String))
  })
})
