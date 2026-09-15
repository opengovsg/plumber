import { createBullBoard } from '@bull-board/api'
import { BullMQProAdapter } from '@bull-board/api/bullMQProAdapter'
import { ExpressAdapter } from '@bull-board/express'

import appConfig from '@/config/app'
import {
  actionBatchQueues,
  appActionQueues,
  mainActionQueue,
} from '@/queues/action'
import flowQueue from '@/queues/flow'
import triggerQueue from '@/queues/trigger'

const serverAdapter = new ExpressAdapter()

const createBullBoardHandler = async (serverAdapter: ExpressAdapter) => {
  if (!appConfig.enableBullMQDashboard) {
    return
  }

  createBullBoard({
    queues: [
      new BullMQProAdapter(flowQueue),
      new BullMQProAdapter(triggerQueue),
      new BullMQProAdapter(mainActionQueue),
      ...Object.values(appActionQueues).map(
        (queue) => new BullMQProAdapter(queue),
      ),
      ...Object.values(actionBatchQueues).map(
        (queue) => new BullMQProAdapter(queue),
      ),
    ],
    serverAdapter: serverAdapter,
    options: {
      uiConfig: {
        favIcon: {
          default: `${appConfig.webAppUrl}/favicon.svg`,
          alternative: 'https://file.go.gov.sg/plumber-logo.png',
        },
        boardLogo: {
          path: 'https://file.go.gov.sg/plumber-logo-full.png',
          height: 70,
        },
        boardTitle: '',
      },
    },
  })
}

export { createBullBoardHandler, serverAdapter }
