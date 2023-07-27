import defineTrigger from '@/helpers/define-trigger'

export default defineTrigger({
  name: 'Catch raw webhook',
  key: 'catchRawWebhook',
  type: 'webhook',
  description: 'Triggers when the webhook receives a request.',
  webhookTriggerTexts: [
    `# 1. You'll need to configure your application with this webhook URL.`,
    `# 2. Send some data to the webhook URL after configuration. Then, click test step.`,
  ],

  async testRun($) {
    const lastExecutionStep = await $.getLastExecutionStep()
    // Allow for empty webhook body
    await $.pushTriggerItem({
      raw: lastExecutionStep?.dataOut ?? {},
      meta: {
        internalId: '',
      },
    })
  },
})
