import emailValidator from 'email-validator'
import { z } from 'zod'

import { zodParser as plumberDate } from '@/helpers/internal-date-format'

export const requestSchema = z
  .object({
    referenceId: z.string().trim().min(1, { message: 'Empty reference ID' }),
    payerName: z.string().trim().min(1, { message: 'Empty payer name' }),
    payerAddress: z.string().trim().min(1, { message: 'Empty payer address' }),
    payerIdentifier: z
      .string()
      .trim()
      .min(1, { message: 'Empty payer identifier' }),
    payerEmail: z
      .string()
      .trim()
      .transform((value, context) => {
        if (value.length === 0) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Empty payer email',
          })
          return z.NEVER
        }

        if (!emailValidator.validate(value)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Invalid payer email',
          })
          return z.NEVER
        }

        return value
      }),
    description: z.string().trim().min(1, { message: 'Empty description' }),
    paymentAmountCents: z
      .string()
      .trim()
      .min(1, { message: 'Empty payment amount' })
      .pipe(
        z.coerce
          .number()
          .min(1, { message: 'Payment amount must be larger than 0' }),
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
          key: z.string().trim().nullish(),
          value: z.string().trim().nullish(),
        }),
      )
      .max(10)
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
          .transform((_val) => null),
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
          .transform((_val) => null),
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

export const responseSchema = z
  .object({
    // Allow nullish in case any part of the API changes...
    id: z.string().nullish(),
    payment_url: z.string().nullish(),
    stripe_payment_intent_id: z.string().nullish(),
    payment_qr_code_url: z.string().nullish(),

    // Rest of fields are not as relevant for our end users, so skip exposing
    // them. We can expose them later if there is a use case.
  })
  .transform((data) => ({
    id: data.id,
    paymentUrl: data.payment_url,
    stripePaymentIntentId: data.stripe_payment_intent_id,
    paymentQrCodeUrl: data.payment_qr_code_url,
  }))
