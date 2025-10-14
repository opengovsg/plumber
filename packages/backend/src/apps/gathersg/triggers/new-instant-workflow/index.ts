import { IGlobalVariable, IRawTrigger } from '@plumber/types'

const trigger: IRawTrigger = {
  name: 'New instant workflow',
  key: 'newInstantWorkflow',
  type: 'webhook',
  description:
    'Executes this Pipe when an instant workflow is triggered from GatherSG',
  webhookTriggerInstructions: {
    beforeUrlMsg: `# 1. Configure your instant workflow using this webhook URL (no encryption key required).`,
    afterUrlMsg: `# 2. Make an update to your case. Then, click check step.`,
  },

  async testRun($: IGlobalVariable) {
    const lastExecutionStep = await $.getLastExecutionStep({
      testRunOnly: true,
    })
    await $.pushTriggerItem({
      raw: lastExecutionStep?.dataOut ?? {},
      meta: {
        internalId: '',
      },
    })
  },
}

export default trigger
