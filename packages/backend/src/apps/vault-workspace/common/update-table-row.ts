import { IGlobalVariable } from '@automatisch/types';

const updateTableRow = async (
  $: IGlobalVariable,
  vaultId: string,
  update: { [key: string]: string } // column name: value
): Promise<void> => {
  await $.http.put('/api/tables/row', { id: vaultId, update });
};

export default updateTableRow;
