import { IGlobalVariable } from '@plumber/types'

import HttpError from '@/errors/http'
import { generateHttpStepError } from '@/helpers/generate-step-error'

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
    .catch((err: HttpError): never => {
      let stepErrorSolution
      if (err.response.status === 403) {
        stepErrorSolution =
          'Click on choose connection and ensure that your vault table is still connected. If not, please copy the new api key generated on vault and re-establish the connection on Plumber.'
      } else {
        // return original error since uncaught
        throw err
      }
      throw generateHttpStepError(
        err,
        stepErrorSolution,
        $.step.position,
        $.app.name,
      )
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
