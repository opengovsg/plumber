import z from 'zod'

type ResponseField = {
  fieldName?: string
  fieldType?: 'text' | 'number' | 'category'
  fieldCategories?: string
}

export function generateSchemaFromFields(fields: ResponseField[]) {
  const schemaShape: Record<string, z.ZodTypeAny> = {}

  for (const field of fields) {
    const { fieldName, fieldType, fieldCategories } = field

    if (!fieldName) {
      continue
    }

    switch (fieldType) {
      case 'text':
        schemaShape[fieldName] = z
          .string()
          // Default value for text fields to avoid issues when the prompt is too vague or when the user is testing with presets
          .default(
            'Sample text. Refine your prompt to generate different outputs!',
          )
          .describe(`Text field: ${fieldName}`)
        break
      case 'number':
        schemaShape[fieldName] = z
          .number()
          // Default value for number fields to avoid issues when the prompt is too vague or when the user is testing with presetss
          .default(0)
          .describe(`Number field: ${fieldName}`)
        break
      case 'category':
        if (fieldCategories) {
          const categoryValues = fieldCategories
            .split(',')
            .map((cat) => cat.trim())
            .filter((cat) => cat.length > 0)

          if (categoryValues.length > 0) {
            // Create enum from categories
            schemaShape[fieldName] = z
              .enum([categoryValues[0], ...categoryValues.slice(1)] as [
                string,
                ...string[],
              ])
              .describe(
                `Category field: ${fieldName}. Must be one of: ${categoryValues.join(
                  ', ',
                )}`,
              )
          } else {
            schemaShape[fieldName] = z
              .string()
              .describe(`Category field: ${fieldName}`)
          }
        } else {
          schemaShape[fieldName] = z
            .string()
            .describe(`Category field: ${fieldName}`)
        }
        break
    }
  }

  // NOTE: we set strict to ensure that the schema rejects any object
  // with fields that are not explicitly defined in the schema
  return z.object(schemaShape).strict()
}
