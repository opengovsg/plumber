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

/**
 * Helper to ensure that `value` one of the values the `enum` Zod enum.
 */
export function ensureZodEnumValue<
  TZodEnum extends z.ZodEnum<any>,
  TValue extends z.infer<TZodEnum>,
>(_enum: TZodEnum, value: TValue): TValue {
  return value
}
