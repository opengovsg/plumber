import { IGlobalVariable } from '@automatisch/types';
import verifyAPIKey from '../common/verify-api-key';

const isStillVerified = async ($: IGlobalVariable) => {
  await verifyAPIKey($);
  return true;
};

export default isStillVerified;
