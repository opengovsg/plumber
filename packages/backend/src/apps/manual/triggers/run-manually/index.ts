import { IGlobalVariable, IRawTrigger } from '@plumber/types'

import { randomUUID } from 'crypto'
import { DateTime } from 'luxon'

const trigger: IRawTrigger = {
  name: 'Run manually',
  key: 'runManually',
  type: 'webhook',
  description: 'Triggers only when a user runs this pipe on demand',

  async run($: IGlobalVariable) {
    const dateTime = DateTime.now()

    await $.pushTriggerItem({
      raw: {
        triggeredAt: dateTime.toISO(),
      },
      meta: {
        internalId: randomUUID(),
      },
    })
  },

  async testRun($: IGlobalVariable) {
    const dateTime = DateTime.now()

    await $.pushTriggerItem({
      raw: {
        triggeredAt: dateTime.toISO(),
      },
      meta: {
        internalId: randomUUID(),
      },
    })
  },
}

export default trigger
