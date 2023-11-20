import { IGlobalVariable } from '@plumber/types'

import { throwGetColumnMappingError } from './throw-errors'

const getColumnMappingInAlias = async (
  $: IGlobalVariable,
): Promise<{ [key: string]: string }> => {
  const mapping = await getColumnMapping($)
  return swap(mapping) // alias: name
}

const getColumnMapping = async (
  $: IGlobalVariable,
): Promise<{ [key: string]: string }> => {
  const response = await $.http
    .get('/api/tables/column-mapping')
    .catch((err): never => {
      throwGetColumnMappingError(err, $.step.position, $.app.name)
    })
  return response.data
}

const swap = (json: { [key: string]: string }) => {
  const reversed: { [key: string]: string } = {}
  for (const key in json) {
    reversed[json[key]] = key
  }
  return reversed
}

export { getColumnMapping, getColumnMappingInAlias }
