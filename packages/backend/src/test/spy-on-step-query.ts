import { vi } from 'vitest'

import Step from '@/models/step'

type QueryChain = Record<string, ReturnType<typeof vi.fn>>

export function spyOnStepQuery(
  implementation: (...args: unknown[]) => QueryChain,
): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(Step, 'query').mockImplementation(implementation as never)
}

export function createStepQueryChain(
  chain: QueryChain,
): (...args: unknown[]) => QueryChain {
  return () => chain
}
