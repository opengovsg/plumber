import { IGlobalVariable } from '@automatisch/types';

const verifyAPIKey = async ($: IGlobalVariable): Promise<string> => {
  const response = await $.http.get('/auth/verify/api-key');

  return response.data.tableName;
};

export default verifyAPIKey;
