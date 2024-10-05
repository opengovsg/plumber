import emailValidator from 'email-validator'
import { z } from 'zod'

import { zodParser as plumberDate } from '@/helpers/internal-date-format'

import { normalizeSpecialChars } from './normalize-special-chars'

export const requestSchema = z
  .object({
    referenceId: z
      .string()
      .trim()
      .min(1, { message: 'Empty reference ID' })
      .max(255, { message: 'Reference ID cannot be more than 255 characters' }),
    payerName: z
      .string()
      .trim()
      .min(1, { message: 'Empty payer name' })
      .max(255, { message: 'Payer name cannot be more than 255 characters' })
      .transform((value) => normalizeSpecialChars(value)),
    payerAddress: z
      .string()
      .trim()
      .max(255, {
        message: 'Payer address cannot be more than 255 characters',
      })
      .transform((value) => {
        if (!value || value.length === 0) {
          return undefined
        }
        return normalizeSpecialChars(value)
      })
      .nullish(),
    payerIdentifier: z
      .string()
      .trim()
      .max(20, {
        message: 'Payer identifier cannot be more than 20 characters',
      })
      .transform((value) => {
        if (!value || value.length === 0) {
          return undefined
        }
        return value
      })
      .nullish(),
    payerEmail: z
      .string()
      .trim()
      .max(255, { message: 'Payer email cannot be more than 255 characters' })
      .transform((value, context) => {
        if (!value || value.length === 0) {
          return undefined
        }
        if (!emailValidator.validate(value)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Invalid payer email',
          })
          return z.NEVER
        }

        return value
      })
      .nullish(),
    description: z
      .string()
      .trim()
      .min(1, { message: 'Empty description' })
      .max(500, { message: 'Payer email cannot be more than 500 characters' }),
    paymentAmountCents: z
      .string()
      .trim()
      .min(1, { message: 'Empty payment amount' })
      .pipe(
        z.coerce
          .number()
          .int('Payment amount must be round number')
          .min(50, { message: 'Payment amount must be larger than 50 cents' })
          .max(99999999, {
            message: 'Payment amount cannot be larger than $999999.99',
          }),
      ),

    //
    // Optional form fields below
    //
    metadata: z
      .array(
        z.object({
          // FIXME (ogp-weeloong): by default, we populate metadata with 1 empty
          // row even if its optional, for UX reasons. For now, account for this
          // case in code until we make the necessary UX changes to not need
          // that 1 empty row.
          key: z
            .string()
            .trim()
            .max(40, {
              message: 'metadata key cannot be more than 40 characters',
            })
            .nullish(),
          value: z
            .string()
            .trim()
            .max(255, {
              message: 'metadata value cannot be more than 255 characters',
            })
            .nullish(),
        }),
      )
      .max(10, 'cannot have more than 10 metadata entries')
      .transform((rawMetadata, context) => {
        // Again.. to remove this when we fix the UX issue.
        const metadata = rawMetadata.filter((metadatum) => !!metadatum.key)

        if (metadata.length === 0) {
          return null
        }

        const result: Record<string, string> = Object.create(null)
        for (const metadatum of metadata) {
          if (!metadatum.value) {
            // Null values are not allowed. This isn't needed once FIXME above
            // is addressed.
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Metadata value cannot be empty',
            })
            return z.NEVER
          }

          result[metadatum.key] = metadatum.value
        }

        return result
      })
      .nullish(),
    dueDate: z
      // Must be a valid plumber date or empty string
      .union([
        plumberDate,
        z
          .string()
          .length(0)
          .transform((_val) => undefined),
      ])
      .nullish(),
    returnUrl: z
      // Must be valid https URL or empty string.
      .union([
        z
          .string()
          .min(1)
          .trim()
          .min(1, { message: 'Empty return URL' }) // After trim
          .url()
          .startsWith('https://', 'Not a https URL'),
        z
          .string()
          .length(0)
          .transform((_val) => undefined),
      ])
      .nullish(),
  })
  // After parsing, convert to PaySG format.
  .transform((data) => ({
    reference_id: data.referenceId,
    payer_name: data.payerName,
    payer_address: data.payerAddress,
    payer_identifier: data.payerIdentifier,
    payer_email: data.payerEmail,
    description: data.description,
    amount_in_cents: data.paymentAmountCents,
    metadata: data.metadata ?? {}, // PaySG requires at least an empty metadata object.
    due_date: data.dueDate?.toFormat('dd-MMM-yyyy')?.toUpperCase(),
    return_url: data.returnUrl,
  }))

export { schema as responseSchema } from '../../common/schemas/payment'
