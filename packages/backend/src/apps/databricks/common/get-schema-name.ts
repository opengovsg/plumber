import { IGlobalVariable } from '@plumber/types'

export const getSchemaName = ($: IGlobalVariable) => {
  const userEmail = $.user.email
  // replace all non-alphanumeric characters with an underscore
  // e.g. john.doe@example.com -> john_doe_example_com
  const schemaName = userEmail.replace(/[^a-zA-Z0-9]/g, '_')
  return schemaName
}
