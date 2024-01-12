import { IRawAction } from '@plumber/types'

import qs from 'qs'

const action: IRawAction = {
  name: 'Send an SMS',
  key: 'sendSms',
  description: 'Sends an SMS with Twilio',
  arguments: [
    {
      label: 'From Number',
      key: 'fromNumber',
      type: 'string' as const,
      required: true,
      description:
        'The number to send the SMS from or your Twilio Messaging Service ID. Include country code prefix if specifying number, e.g. +6581237123',
      variables: true,
    },
    {
      label: 'To Number',
      key: 'toNumber',
      type: 'string' as const,
      required: true,
      description:
        'The number to send the SMS to. Include country code prefix, e.g. +6581237123',
      variables: true,
    },
    {
      label: 'Message',
      key: 'message',
      type: 'string' as const,
      required: true,
      description: 'The message to send.',
      variables: true,
    },
  ],

  async run($) {
    const requestPath = `/2010-04-01/Accounts/${$.auth.data.accountSid}/Messages.json`
    const messageBody = $.step.parameters.message

    const fromNumber = ($.step.parameters.fromNumber as string).trim()
    const toNumber = ($.step.parameters.toNumber as string).trim()

    const response = await $.http.post(
      requestPath,
      qs.stringify({
        Body: messageBody,
        From: fromNumber,
        To: toNumber,
      }),
    )
    const { from, to, body, status, sid } = response.data
    $.setActionItem({ raw: { from, to, body, status, sid, success: true } })
  },
}

export default action
