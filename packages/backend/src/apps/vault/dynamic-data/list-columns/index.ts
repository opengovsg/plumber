import { IGlobalVariable } from '@automatisch/types';
import { getColumnMappingInAlias } from '../../common/get-column-mapping';

export default {
  name: 'List columns',
  key: 'listColumns',

  async run($: IGlobalVariable) {
    const mapping = await getColumnMappingInAlias($);
    const response: { [key: string]: { name: string; value: string }[] } = {
      data: [],
    };

    // NOTE: vault workspace has pre-defined column called vault_id
    response.data.push({
      name: 'vault_id',
      value: 'vault_id',
    });

    for (const key in mapping) {
      response.data.push({
        name: key,
        value: mapping[key],
      });
    }
    return response;
  },
};
