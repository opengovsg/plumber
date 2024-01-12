import { IGlobalVariable, IRawTrigger } from '@plumber/types'

const trigger: IRawTrigger = {
  name: 'Catch raw webhook',
  key: 'catchRawWebhook',
  type: 'webhook',
  description: 'Triggers when the webhook receives a request',
  webhookTriggerInstructions: {
    beforeUrlMsg: `# 1. You'll need to configure your application with this webhook URL.`,
    afterUrlMsg: `# 2. Send some data to the webhook URL after configuration. Then, click test step.`,
  },

  async testRun($: IGlobalVariable) {
    const lastExecutionStep = await $.getLastExecutionStep()
    // Allow for empty webhook body
    await $.pushTriggerItem({
      raw: lastExecutionStep?.dataOut ?? {},
      meta: {
        internalId: '',
      },
    })
  },
}

export default trigger
