import { IGlobalVariable } from '@automatisch/types';

const unregisterWebhook = async ($: IGlobalVariable): Promise<void> => {
  await $.http.delete('/api/tables/event/webhook', {
    headers: {
      authorization: `Bearer ${$.auth.data.apiKey as string}`,
    },
  });
};

export default unregisterWebhook;
