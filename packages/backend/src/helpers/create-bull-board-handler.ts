import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter } from '@bull-board/express'

import appConfig from '@/config/app'
import actionQueue from '@/queues/action'
import flowQueue from '@/queues/flow'
import triggerQueue from '@/queues/trigger'

const serverAdapter = new ExpressAdapter()

const createBullBoardHandler = async (serverAdapter: ExpressAdapter) => {
  if (!appConfig.enableBullMQDashboard) {
    return
  }

  createBullBoard({
    queues: [
      new BullMQAdapter(flowQueue),
      new BullMQAdapter(triggerQueue),
      new BullMQAdapter(actionQueue),
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
