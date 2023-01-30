import { TBeforeRequest } from '@automatisch/types';

const addAuthHeader: TBeforeRequest = ($, requestConfig) => {
  if (requestConfig.headers && $.auth.data?.apiKey) {
    requestConfig.headers['Authorization'] = `Bearer ${$.auth.data.apiKey}`;
  }

  return requestConfig;
};

export default addAuthHeader;
