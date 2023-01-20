import defineTrigger from '../../../../helpers/define-trigger';
import getColumnMapping from '../../common/get-column-mapping';
import registerWebhook from '../../common/register-webhook';
import unregisterWebhook from '../../common/unregister-webhook';

export default defineTrigger({
  name: 'On Row Created',
  key: 'onRowCreated',
  type: 'webhook',
  description: 'Triggers when the webhook receives a request.',

  async run($) {
    $.pushTriggerItem({
      raw: $.lastExecutionStep.dataOut,
      meta: {
        internalId: $.lastExecutionStep.dataOut.id as string,
      },
    });
  },

  async testRun($) {
    const columnMapping = await getColumnMapping($);
    const exampleData: { [key: string]: string } = {};
    for (const key of Object.keys(columnMapping)) {
      exampleData[key] = '<Place Holder>';
    }

    $.pushTriggerItem({
      raw: exampleData,
      meta: {
        internalId: 'test',
      },
    });
  },

  async registerHook($) {
    await registerWebhook($);
  },

  async unregisterHook($) {
    await unregisterWebhook($);
  },
});
