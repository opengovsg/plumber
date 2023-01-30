import { IGlobalVariable } from '@automatisch/types';

const getColumnMappingInAlias = async (
  $: IGlobalVariable
): Promise<{ [key: string]: string }> => {
  const mapping = await getColumnMapping($);
  return swap(mapping); // alias: name
};

const getColumnMapping = async (
  $: IGlobalVariable
): Promise<{ [key: string]: string }> => {
  const response = await $.http.get('/api/tables/column-mapping');
  return response.data;
};

const swap = (json: { [key: string]: string }) => {
  const reversed: { [key: string]: string } = {};
  for (const key in json) {
    reversed[json[key]] = key;
  }
  return reversed;
}

export { getColumnMappingInAlias, getColumnMapping };
