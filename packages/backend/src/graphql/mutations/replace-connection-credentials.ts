import { ForbiddenError } from '@/errors/graphql-errors'
import buildConnectionEditCandidate from '@/helpers/build-connection-edit-candidate'
import globalVariable from '@/helpers/global-variable'
import App from '@/models/app'
import { getOwnEditableConnection } from '@/services/connection'

import type { MutationResolvers } from '../__generated__/types.generated'

const replaceConnectionCredentials: MutationResolvers['replaceConnectionCredentials'] =
  async (_parent, params, context) => {
    const connection = await getOwnEditableConnection({
      context,
      connectionId: params.input.id,
    })
    const app = await App.findOneByKey(connection.key)

    if (
      app.auth?.connectionType !== 'user-added' ||
      !app.auth.supportsConnectionEdit
    ) {
      throw new ForbiddenError('This connection cannot be edited')
    }

    const candidate = buildConnectionEditCandidate({
      app,
      storedData: connection.formattedData,
      submittedData: params.input.formattedData,
    })
    const $ = await globalVariable({
      connection,
      app,
      user: context.currentUser,
      authData: candidate,
      persistAuthData: false,
    })

    await app.auth.verifyCredentials($)

    const updatedConnection = await connection.$query().patchAndFetch({
      formattedData: $.auth.data,
      verified: true,
      draft: false,
    })

    return {
      ...updatedConnection,
      app,
    }
  }

export default replaceConnectionCredentials
