import { IGlobalVariable } from '@automatisch/types';
import { getColumnMappingInAlias } from './get-column-mapping';

const createTableRow = async (
  $: IGlobalVariable,
  rowData: { [key: string]: string }
): Promise<void> => {
  // get column mappings
  let columnMapping = await getColumnMappingInAlias($);
  const columnAliases = Object.keys(columnMapping);

  // create column if not exists
  for (const key in rowData) {
    if (!columnAliases.includes(key)) {
      await $.http.post('/api/tables/column', { columnAlias: key });
    }
  }

  // get column mappings again (with newly created rows)
  columnMapping = await getColumnMappingInAlias($);

  // replace alias with column name
  const payload: { [key: string]: string } = {};
  for (const key in rowData) {
    payload[columnMapping[key]] = rowData[key];
  }

  // send data
  await $.http.post('/api/tables/row', { data: payload });
};

export default createTableRow;
