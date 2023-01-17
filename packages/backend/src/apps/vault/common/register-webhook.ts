import { IGlobalVariable } from '@automatisch/types';

const registerWebhook = async ($: IGlobalVariable): Promise<void> => {
  if (!$.webhookUrl) {
    throw new Error('Webhook url is not set');
  }
  await $.http.post(
    '/api/tables/event/webhook',
    { url: $.webhookUrl },
    {
      headers: {
        authorization: `Bearer ${$.auth.data.apiKey as string}`,
      },
    }
  );
};

export default registerWebhook;
