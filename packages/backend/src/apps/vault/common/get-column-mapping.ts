import { IGlobalVariable } from '@automatisch/types';

const getColumnMapping = async (
  $: IGlobalVariable
): Promise<{ [key: string]: string }> => {
  // get column mappings
  const columnMappingResponse = await $.http.get('/api/tables/column-mapping');
  const columnMapping = swap(columnMappingResponse.data); // alias: name
  return columnMapping;
};

function swap(json: { [key: string]: string }) {
  const reversed: { [key: string]: string } = {};
  for (const key in json) {
    reversed[json[key]] = key;
  }
  return reversed;
}

export default getColumnMapping;
