import axios from 'axios'

import GenerateAuthUrlError from '@/errors/generate-auth-url'
import { ForbiddenError } from '@/errors/graphql-errors'
import globalVariable from '@/helpers/global-variable'
import App from '@/models/app'
import { getConnection } from '@/services/connection'

import type { MutationResolvers } from '../__generated__/types.generated'

const generateAuthUrl: MutationResolvers['generateAuthUrl'] = async (
  _parent,
  params,
  context,
) => {
  const flow = await context.currentUser
    .withAccessibleFlows({ requiredRole: 'editor' })
    .findById(params.input.flowId)
    .throwIfNotFound({ message: 'You do not have access to this flow' })

  const connection = await getConnection({
    context,
    connectionId: params.input.id,
    flowId: params.input.flowId,
    includeOwnConnections: flow.role === 'owner',
  })

  // GUARD: Prevent updating personal connections owned by others
  if (
    connection.userId !== null &&
    connection.userId !== context.currentUser.id
  ) {
    throw new ForbiddenError(
      'You cannot generate an auth URL for a personal connection that you do not own',
    )
  }

  if (!connection.formattedData) {
    return null
  }

  // Path aliases dont work for dynamic imports, so we need to use relative paths here
  // ref: https://github.com/justkey007/tsc-alias/issues/156
  const authInstance = (await import(`../../apps/${connection.key}/auth`))
    .default
  const app = await App.findOneByKey(connection.key)

  const $ = await globalVariable({ connection, app, user: context.currentUser })
  try {
    await authInstance.generateAuthUrl($)
    await axios.get(connection.formattedData.url as string)
  } catch (error) {
    throw new GenerateAuthUrlError(error)
  }

  return connection.formattedData
}

export default generateAuthUrl
