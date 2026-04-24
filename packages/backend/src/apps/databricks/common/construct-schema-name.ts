import { IGlobalVariable } from '@plumber/types'

export const constructSchemaNameFromEmail = (email: string): string => {
  return email.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
}

export const constructSchemaName = ($: IGlobalVariable): string => {
  const userEmail = $.user?.email
  if (!userEmail) {
    throw new Error('User email is required')
  }
  return constructSchemaNameFromEmail(userEmail)
}
