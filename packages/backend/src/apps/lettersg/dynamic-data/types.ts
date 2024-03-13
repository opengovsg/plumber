// Reference: https://guide.letters.gov.sg/developer-guide/upcoming-api-documentation
// TODO (mal): Perform zod validation on this
export type Template = {
  templateId: string
  fields: string[]
  name: string
  createdAt: string
  updatedAt: string
}
