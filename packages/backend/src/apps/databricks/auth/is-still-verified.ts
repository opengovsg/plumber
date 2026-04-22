import { IGlobalVariable } from '@plumber/types'

import Connection from '@/models/connection'

import { checkSchemaExists } from './check-schema-exists'

const isStillVerified = async ($: IGlobalVariable) => {
  const databricksConnection = await Connection.query().findById(
    $.auth.connectionId,
  )

  if (!databricksConnection) {
    return false
  }

  // Once a schema has been seen, we skip re-checking Databricks on every test
  // to avoid opening a SQL session per call.
  if (databricksConnection.verified) {
    return true
  }
  return checkSchemaExists($)
}

export default isStillVerified
