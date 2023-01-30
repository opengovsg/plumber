import { IGlobalVariable } from '@automatisch/types';
import verifyAPIKey from '../common/verify-api-key';

const verifyCredentials = async ($: IGlobalVariable) => {
  const tableName = await verifyAPIKey($);
  await $.auth.set({
    consumerSecret: $.auth.data.consumerSecret,
    screenName: tableName,
  });
};

export default verifyCredentials;
