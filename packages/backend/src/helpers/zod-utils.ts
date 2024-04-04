import z, { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

/**
 * Helper to ensure that `key` is an string object key in `schema`.
 */
export function ensureZodObjectKey<
  TZodObject extends z.ZodObject<any>,
  TKey extends string & keyof z.infer<TZodObject>,
>(_schema: TZodObject, key: TKey): TKey {
  return key
}

/**
 * Helper to extract a message containing details about the 1st Zod parsing
 * error. If a path is available, it also puts the path in the error message.
 */
export function firstZodParseError(error: ZodError): string {
  const firstError = fromZodError(error).details[0]

  if (firstError.path.length === 0) {
    return firstError.message
  } else {
    return `${firstError.message} in the ${
      firstError.path[firstError.path.length - 1]
    } field`
  }
}
