import { IRawTrigger } from '@plumber/types'

import fetchMessages from './fetch-messages'

const trigger: IRawTrigger = {
  name: 'Receive SMS',
  key: 'receiveSms',
  pollInterval: 15,
  description: 'Triggers when a new SMS is received.',
  arguments: [
    {
      label: 'To Number',
      key: 'toNumber',
      type: 'string',
      required: true,
      description:
        'The number to receive the SMS on. It should be a Twilio number.',
    },
  ],

  async run($) {
    await fetchMessages($)
  },
}

export default trigger
