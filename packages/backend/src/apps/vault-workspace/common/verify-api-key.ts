import { IGlobalVariable } from '@automatisch/types';

const verifyAPIKey = async ($: IGlobalVariable): Promise<string> => {
  const response = await $.http.get('/api/auth/whoami', {
    headers: {
      authorization: `Bearer ${$.auth.data.apiKey as string}`,
    },
  });

  return response.data.tableName;
};

export default verifyAPIKey;
