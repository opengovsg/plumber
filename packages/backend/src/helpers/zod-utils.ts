import z from 'zod'

/**
 * Helper to ensure that `key` is an string object key in `schema`.
 */
export function ensureZodObjectKey<
  TZodObject extends z.ZodObject<any>,
  TKey extends string & keyof z.infer<TZodObject>,
>(_schema: TZodObject, key: TKey): TKey {
  return key
}
