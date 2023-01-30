import { IGlobalVariable } from '@automatisch/types';

const unregisterWebhook = async ($: IGlobalVariable): Promise<void> => {
  await $.http.delete('/api/tables/event/webhook');
};

export default unregisterWebhook;
