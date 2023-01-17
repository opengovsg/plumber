import { IGlobalVariable } from '@automatisch/types';
import getColumnMapping from './get-column-mapping';

const createTableRow = async (
  $: IGlobalVariable,
  rowData: { [key: string]: string }
): Promise<void> => {
  // get column mappings
  let columnMapping = await getColumnMapping($);
  const columnAliases = Object.keys(columnMapping);

  // create column if not exists
  for (const key of Object.keys(rowData)) {
    if (!columnAliases.includes(key)) {
      await $.http.post(
        '/api/tables/column',
        { columnAlias: key },
        {
          headers: {
            authorization: `Bearer ${$.auth.data.apiKey as string}`,
          },
        }
      );
    }
  }

  // get column mappings again (with newly created rows)
  columnMapping = await getColumnMapping($);

  // replace alias with column name
  const payload: { [key: string]: string } = {};
  for (const key of Object.keys(rowData)) {
    payload[columnMapping[key]] = rowData[key];
  }

  // send data
  await $.http.post(
    '/api/tables/row',
    { data: payload },
    {
      headers: {
        authorization: `Bearer ${$.auth.data.apiKey as string}`,
      },
    }
  );
};

export default createTableRow;
