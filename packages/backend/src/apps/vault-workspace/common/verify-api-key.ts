import { IGlobalVariable } from '@automatisch/types';

const verifyAPIKey = async ($: IGlobalVariable): Promise<string> => {
  const response = await $.http.get('/auth/verify/api-key', {
    headers: {
      authorization: `Bearer ${$.auth.data.apiKey as string}`,
    },
  });

  return response.data.tableName;
};

export default verifyAPIKey;
