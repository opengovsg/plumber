import '@/types/luxon-extensions'
import type { IRawTrigger, ITriggerItem } from '@plumber/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import everyDay from '@/apps/scheduler/triggers/every-day'
import everyHour from '@/apps/scheduler/triggers/every-hour'
import everyMonth from '@/apps/scheduler/triggers/every-month'
import everyWeek from '@/apps/scheduler/triggers/every-week'

import { processFlow } from '../flow'

const mocks = vi.hoisted(() => ({
  triggerStep: {
    id: 'trigger-step-id',
    getTriggerCommand: vi.fn(),
    getApp: vi.fn(async () => ({ key: 'scheduler' })),
    $relatedQuery: vi.fn(async (): Promise<null> => null),
  },
  globalVariable: vi.fn(),
}))

vi.mock('@/models/flow', () => {
  const query = {
    findById: () => query,
    withGraphJoined: () => query,
    throwIfNotFound: async () => ({
      active: true,
      getTriggerStep: async () => mocks.triggerStep,
    }),
  }
  return { default: { query: () => query } }
})

vi.mock('@/helpers/global-variable', () => ({
  default: mocks.globalVariable,
}))

describe('processFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each<IRawTrigger>([everyHour, everyDay, everyWeek, everyMonth])(
    'runs the $key scheduler trigger as a method of its trigger',
    async (trigger) => {
      mocks.triggerStep.getTriggerCommand.mockResolvedValue(trigger)
      const triggerOutput: { data: ITriggerItem[] } = { data: [] }
      mocks.globalVariable.mockResolvedValue({
        step: {
          parameters: { triggersOnWeekend: true, hour: 9, weekday: 1, day: 1 },
        },
        execution: { testRun: false },
        triggerOutput,
        pushTriggerItem: async (item: ITriggerItem) => {
          triggerOutput.data.push(item)
        },
      })

      const output = await processFlow({ flowId: 'flow-id' })

      expect(output).toEqual({ data: [expect.anything()] })
    },
  )
})
