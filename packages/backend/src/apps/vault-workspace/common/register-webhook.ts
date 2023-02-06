import { IGlobalVariable } from '@automatisch/types';

const registerWebhook = async (
  $: IGlobalVariable,
  event: string
): Promise<void> => {
  if (!$.webhookUrl) {
    throw new Error('Webhook url is not set');
  }
  await $.http.post('/api/tables/event/webhook', {
    event,
    url: $.webhookUrl,
  });
};

const unregisterWebhook = async (
  $: IGlobalVariable,
  event: string
): Promise<void> => {
  await $.http.delete('/api/tables/event/webhook', {
    data: { event },
  });
};

export { registerWebhook, unregisterWebhook };
