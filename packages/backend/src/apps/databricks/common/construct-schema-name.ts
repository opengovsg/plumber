import { IGlobalVariable } from '@plumber/types'

export const constructSchemaNameFromEmail = (email: string): string => {
  return email.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
}

export const constructSchemaName = ($: IGlobalVariable): string => {
  // We shouldnt use $.user.email or else collaborators will end up using their own email
  // instead, we should use the connection that has been set
  const userEmail = $.auth?.data?.screenName
  if (!userEmail || typeof userEmail !== 'string') {
    throw new Error('Not connected to databricks: missing user email')
  }
  return userEmail
}
