import defineTrigger from '../../../../helpers/define-trigger'
import { getColumnMappingInAlias } from '../../common/get-column-mapping'
import getExampleRow from '../../common/get-example-row'
import {
  registerWebhook,
  unregisterWebhook,
} from '../../common/register-webhook'

export default defineTrigger({
  name: 'On Row Update',
  key: 'updateRowEvent',
  type: 'webhook',
  description: 'Triggers when the webhook receives a request.',

  async run($) {
    $.pushTriggerItem({
      raw: $.lastExecutionStep.dataOut,
      meta: {
        internalId: $.lastExecutionStep.dataOut.id as string,
      },
    })
  },

  async testRun($) {
    let row: { [key: string]: string } = {}

    // try to fetch one actual row from vault workspace
    // if it doesn't exist, try getting column aliases
    // and show a fake row with column aliases
    try {
      row = await getExampleRow($)
    } catch (e) {
      console.error(e.message)
      const columnMapping = await getColumnMappingInAlias($)
      for (const key of Object.keys(columnMapping)) {
        row[key] = '<Place Holder>'
      }
    }

    $.pushTriggerItem({
      raw: row,
      meta: {
        internalId: 'test',
      },
    })
  },

  async registerHook($) {
    await registerWebhook($, 'update')
  },

  async unregisterHook($) {
    await unregisterWebhook($, 'update')
  },
})
