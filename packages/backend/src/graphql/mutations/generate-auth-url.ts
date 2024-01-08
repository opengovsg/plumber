import axios from 'axios'

import GenerateAuthUrlError from '@/errors/generate-auth-url'
import globalVariable from '@/helpers/global-variable'
import App from '@/models/app'
import Context from '@/types/express/context'

type Params = {
  input: {
    id: string
  }
}

const generateAuthUrl = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  const connection = await context.currentUser
    .$relatedQuery('connections')
    .findOne({
      id: params.input.id,
    })
    .throwIfNotFound()

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
