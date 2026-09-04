import { z, ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import { BadUserInputError } from '@/errors/graphql-errors'
import buildConnectionEditCandidate from '@/helpers/build-connection-edit-candidate'
import globalVariable from '@/helpers/global-variable'
import { getOwnEditableConnection } from '@/services/connection'

import type { MutationResolvers } from '../__generated__/types.generated'

const replaceConnectionCredentialsInputSchema = z.object({
  id: z.string().trim().min(1, 'Connection id is required'),
  formattedData: z.record(z.string(), z.unknown()),
})

const replaceConnectionCredentials: MutationResolvers['replaceConnectionCredentials'] =
  async (_parent, params, context) => {
    let input: z.infer<typeof replaceConnectionCredentialsInputSchema>
    try {
      input = replaceConnectionCredentialsInputSchema.parse(params.input)
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadUserInputError(
          fromZodError(error).details[0]?.message ?? 'Invalid connection data',
        )
      }
      throw error
    }

    const { connection, app } = await getOwnEditableConnection({
      context,
      connectionId: input.id,
    })

    const candidate = buildConnectionEditCandidate({
      appKey: app.key,
      auth: app.auth,
      storedData: connection.formattedData,
      submittedData: input.formattedData,
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
