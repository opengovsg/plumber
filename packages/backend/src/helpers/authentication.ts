import { allow, rule, shield } from 'graphql-shield'
import jwt from 'jsonwebtoken'

import appConfig from '../config/app'
import User from '../models/user'

const isAuthenticated = rule()(async (_parent, _args, req) => {
  const token = req.headers['authorization']

  if (token == null) {
    return false
  }

  try {
    const { userId } = jwt.verify(token, appConfig.sessionSecretKey) as {
      userId: string
    }
    req.currentUser = await User.query().findById(userId).throwIfNotFound()

    return true
  } catch (error) {
    return false
  }
})

const authentication = shield(
  {
    Query: {
      '*': isAuthenticated,
      healthcheck: allow,
    },
    Mutation: {
      '*': isAuthenticated,
      requestOtp: allow,
      verifyOtp: allow,
    },
  },
  {
    allowExternalErrors: true,
  },
)

export default authentication
