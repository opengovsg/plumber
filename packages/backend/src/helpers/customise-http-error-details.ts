import HttpError from '@/errors/http'

export default function customiseHttpErrorDetails(httpError: HttpError) {
  return {
    details: httpError.details,
    status: httpError.response.status,
    statusText: httpError.response.statusText,
  }
}
