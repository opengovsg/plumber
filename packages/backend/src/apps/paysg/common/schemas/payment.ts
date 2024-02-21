import z from 'zod'

export const schema = z
  .object({
    id: z.string(),
    payment_url: z.string(),
    payment_qr_code_url: z.string(),
    amount_in_cents: z.number(),
    payment_status: z.string(),

    // Null if user is not on stripe.
    stripe_payment_intent_id: z.string().nullish(),

    // Rest of fields are not as relevant for our end users, so skip exposing
    // them. We can expose them later if there is a use case.
  })
  .transform((data) => ({
    id: data.id,
    paymentUrl: data.payment_url,
    stripePaymentIntentId: data.stripe_payment_intent_id,
    paymentQrCodeUrl: data.payment_qr_code_url,
    amountInDollars: (data.amount_in_cents / 100).toFixed(2),
    amountInCents: data.amount_in_cents,
    paymentStatus: data.payment_status,
  }))

// Example payment object (after zod transform):
// {
//   "id": "abcdef",
//   "paymentUrl": "https://topkek.pay.gov.sg/payments/abcdef",
//   "amountInCents": 1234,
//   "amountInDollars": "12.34",
//   "paymentQrCodeUrl": "https://topkek.api.pay.gov.sg/v1/public/payments/abcd-qr.png",
//   "stripePaymentIntentId": "abcd_qwerty",
//   "paymentStatus": "paid"
// }
