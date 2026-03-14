import { IGlobalVariable } from '@plumber/types'

import logger from '@/helpers/logger'

import { FormSchema } from '../../common/types'

export async function fetchFormSchema(
  $: IGlobalVariable,
  formId: string,
): Promise<FormSchema> {
  try {
    const { data } = await $.http.get('/v3/forms/:formId', {
      urlPathParams: {
        formId,
      },
    })

    return data
  } catch (e) {
    logger.error(
      'fetchFormSchema: error fetching form schema',
      $.auth.data?.formId,
      e,
    )
    if (e.response?.status === 404) {
      if (e.response.data?.isPageFound) {
        // form is valid but not public
        throw new Error('Ensure form is public')
      }
    }
    throw new Error('Unable to fetch form. Form might not exist.')
  }
}
