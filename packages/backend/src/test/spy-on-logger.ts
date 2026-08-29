import { vi } from 'vitest'

import logger from '@/helpers/logger'

export function spyOnLogger(options?: {
  error?: ReturnType<typeof vi.fn>
  warn?: ReturnType<typeof vi.fn>
  info?: ReturnType<typeof vi.fn>
}): {
  error: ReturnType<typeof vi.fn>
  warn: ReturnType<typeof vi.fn>
  info: ReturnType<typeof vi.fn>
} {
  const spies = {
    error: options?.error ?? vi.fn(),
    warn: options?.warn ?? vi.fn(),
    info: options?.info ?? vi.fn(),
  }

  vi.spyOn(logger, 'error').mockImplementation(spies.error)
  vi.spyOn(logger, 'warn').mockImplementation(spies.warn)
  vi.spyOn(logger, 'info').mockImplementation(spies.info)

  return spies
}
