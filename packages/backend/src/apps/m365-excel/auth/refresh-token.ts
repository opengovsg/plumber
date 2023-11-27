import type { IAuth } from '@plumber/types'

const refreshToken: NonNullable<IAuth['refreshToken']> = async function (_$) {
  // This is a no-op, because our beforeRequest.addAuthToken will automatically
  // refresh the token when our response interceptor retries from a 401.
}

export default refreshToken
