import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter } from '@bull-board/express'

import appConfig from '@/config/app'
import { appActionQueues, defaultActionQueue } from '@/queues/action'
import flowQueue from '@/queues/flow'
import triggerQueue from '@/queues/trigger'

const serverAdapter = new ExpressAdapter()

const createBullBoardHandler = async (serverAdapter: ExpressAdapter) => {
  if (
    !appConfig.enableBullMQDashboard ||
    !appConfig.bullMQDashboardUsername ||
    !appConfig.bullMQDashboardPassword
  ) {
    return
  }

  createBullBoard({
    queues: [
      new BullMQAdapter(flowQueue),
      new BullMQAdapter(triggerQueue),
      new BullMQAdapter(defaultActionQueue),
      ...[...appActionQueues.values()].map((queue) => new BullMQAdapter(queue)),
    ],
    serverAdapter: serverAdapter,
  })
}

export { createBullBoardHandler, serverAdapter }
