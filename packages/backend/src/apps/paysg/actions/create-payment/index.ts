import type { IJSONObject, IRawAction } from '@plumber/types'

import getApiBaseUrl from '../../common/get-api-base-url'

type CreatePaymentPayload = {
  reference_id: string
  payer_name: string
  payer_address: string
  payer_identifier: string
  payer_email: string
  description: string
  amount_in_cents: number
  metadata: Record<string, string>
  due_date?: string
  return_url?: string
}

function constructPayload(parameters: IJSONObject): CreatePaymentPayload {
  const payload: CreatePaymentPayload = {
    reference_id: parameters.referenceId as string,
    payer_name: parameters.payerName as string,
    payer_address: parameters.payerAddress as string,
    payer_identifier: parameters.payerIdentifier as string,
    payer_email: parameters.payerEmail as string,
    description: parameters.description as string,
    amount_in_cents: Number(parameters.paymentAmountCents),
    metadata: Object.create(null),
  }

  if (parameters.dueDate) {
    payload['due_date'] = parameters.dueDate as string
  }

  if (parameters.returnUrl) {
    payload['return_url'] = parameters.returnUrl as string
  }

  // FIXME (ogp-weeloong): by default, we populate metadata with 1 empty row
  // even if its optional, for UX reasons. for now, account for this case in
  // code until we make the necessary UX changes to not need that 1 empty row.
  const metadata = ((parameters.metadata as IJSONObject[] | null) ?? []).filter(
    (metadatum) => !!metadatum.key,
  )
  if (metadata?.length) {
    for (const metadatum of metadata) {
      const { key, value } = metadatum as { key: string; value: string }
      payload['metadata'][key] = value
    }
  }

  return payload
}

const action: IRawAction = {
  name: 'Create Payment',
  key: 'createPayment',
  description: 'Create a new PaySG payment',
  arguments: [
    {
      label: 'Reference ID',
      key: 'referenceId',
      type: 'string' as const,
      required: true,
      variables: true,
    },
    {
      label: 'Payer Name',
      key: 'payerName',
      type: 'string' as const,
      required: true,
      variables: true,
    },
    {
      label: 'Payer Address',
      key: 'payerAddress',
      type: 'string' as const,
      required: true,
      variables: true,
    },
    {
      label: 'Payer Identifier',
      description: 'e.g. NRIC',
      key: 'payerIdentifier',
      type: 'string' as const,
      required: true,
      variables: true,
    },
    {
      label: 'Payer Email',
      key: 'payerEmail',
      type: 'string' as const,
      required: true,
      variables: true,
    },
    {
      label: 'Description',
      key: 'description',
      type: 'string' as const,
      required: true,
      variables: true,
    },
    {
      label: 'Payment amount (in cents)',
      key: 'paymentAmountCents',
      type: 'string' as const,
      required: true,
      variables: true,
    },
    {
      label: 'Due Date',
      description: 'Must be formatted as DD-MM-YYYY (e.g. 31-DEC-2023)',
      key: 'dueDate',
      type: 'string' as const,
      required: false,
      variables: true,
    },
    {
      label: 'Return URL',
      key: 'returnUrl',
      type: 'string' as const,
      required: false,
      variables: true,
    },
    {
      label: 'Metadata',
      key: 'metadata',
      type: 'multirow' as const,
      required: false,
      subFields: [
        {
          placeholder: 'Key',
          key: 'key',
          type: 'string' as const,
          required: true,
          variables: true,
        },
        {
          placeholder: 'Value',
          key: 'value',
          type: 'string' as const,
          required: true,
          variables: true,
        },
      ],
    },
  ],

  async run($) {
    const apiKey = $.auth.data.apiKey as string
    const baseUrl = getApiBaseUrl(apiKey)
    const paymentServiceId = $.auth.data.paymentServiceId as string
    const payload = constructPayload($.step.parameters)

    const response = await $.http.post(
      `/v1/payment-services/${paymentServiceId}/payments`,
      payload,
      {
        baseURL: baseUrl,
        headers: {
          'x-api-key': apiKey,
        },
      },
    )

    $.setActionItem({ raw: { ...response.data } })
  },
}

export default action
