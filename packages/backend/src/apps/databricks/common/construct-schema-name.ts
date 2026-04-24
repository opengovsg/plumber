import { IGlobalVariable } from '@plumber/types'

export const constructSchemaName = ($: IGlobalVariable) => {
  const userEmail = $.user?.email
  if (!userEmail) {
    throw new Error('User email is required')
  }
  // replace non-alphanumeric characters with underscore
  return userEmail.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
}
