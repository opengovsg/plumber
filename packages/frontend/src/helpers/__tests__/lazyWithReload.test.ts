import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { importWithReload } from '@/helpers/lazyWithReload'

const CHUNK_RELOAD_KEY = 'chunk-reload'

describe('importWithReload', () => {
  const store = new Map<string, string>()
  const reload = vi.fn()

  beforeEach(() => {
    store.clear()
    reload.mockReset()
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    })
    vi.stubGlobal('window', { location: { reload } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the module when the import succeeds', async () => {
    const module = { default: 'component' }

    await expect(importWithReload(async () => module)).resolves.toBe(module)
    expect(reload).not.toHaveBeenCalled()
  })

  it('reloads once and stays pending when the import fails', async () => {
    const result = importWithReload(() =>
      Promise.reject(new Error('Failed to fetch dynamically imported module')),
    )
    const settled = vi.fn()
    result.then(settled, settled)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(reload).toHaveBeenCalledTimes(1)
    expect(store.get(CHUNK_RELOAD_KEY)).toBe('1')
    expect(settled).not.toHaveBeenCalled()
  })

  it('rejects with the import error when the import fails again after a reload', async () => {
    store.set(CHUNK_RELOAD_KEY, '1')
    const error = new Error('Failed to fetch dynamically imported module')

    await expect(importWithReload(() => Promise.reject(error))).rejects.toBe(
      error,
    )
    expect(reload).not.toHaveBeenCalled()
    expect(store.has(CHUNK_RELOAD_KEY)).toBe(false)
  })
})
