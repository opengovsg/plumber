import type { IGlobalVariable, IUserAddedConnectionAuth } from '@plumber/types'

import HttpError from '@/errors/http'

import { authDataSchema } from './schema'

const isStillVerified: IUserAddedConnectionAuth['isStillVerified'] = async (
  $: IGlobalVariable,
) => {
  const { campaignId } = authDataSchema.parse($.auth.data)

  try {
    // Use message retrieval API as a test query
    await $.http.get('/campaigns/:campaignId/messages?limit=1', {
      urlPathParams: {
        campaignId,
      },
    })
    return true
  } catch (error) {
    if (!(error instanceof HttpError)) {
      throw error
    }

    if (
      error.response.status === 400 &&
      error.response.data?.error?.code === 'invalid_ip_address_used'
    ) {
      throw new Error("Plumber's IPs are not whitelisted in your campaign")
    }

    if (error.response.status === 401) {
      throw new Error('Provided API key is not for the provided campaign')
    }

    throw error
  }
}

export default isStillVerified
