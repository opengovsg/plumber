import { CASE_UUID_REGEX } from './constants'

interface ValidateDynamicFieldsProps {
  caseUuid: string
}

export function validateDynamicFieldsAndThrowError({
  caseUuid,
}: ValidateDynamicFieldsProps): void {
  if (!CASE_UUID_REGEX.test(caseUuid)) {
    throw new Error('Your case uuid is of an invalid format')
  }
}
