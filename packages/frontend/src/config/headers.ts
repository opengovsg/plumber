export const RESPONSE_HEADERS = {
  // this header indicates that request is from OGP office wifi
  OGP_INTERNAL_HEADER: 'x-ogp-internal',
}

export type ResponseHeader =
  (typeof RESPONSE_HEADERS)[keyof typeof RESPONSE_HEADERS]
