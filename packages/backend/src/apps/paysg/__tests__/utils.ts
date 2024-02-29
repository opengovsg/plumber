// Mock data retrieved from PaySG Guide: https://guide.pay.gov.sg/api-resources/payments/create-a-payment
export const MOCK_PAYMENT = {
  id: 'ZbzTvadjmP0wd7RRxhWtj',
  due_date: null as null,
  metadata: {
    'product code': '123',
  },
  payout_id: null as null,
  created_at: '2023-08-03T17:36:52.634+08:00',
  creator_id: 'user_xxx',
  payer_name: 'Andy Lau',
  updated_at: '2023-08-03T17:36:52.634+08:00',
  description: 'Payment for XXX',
  payer_email: 'abc@gmail.com',
  payment_url: 'http://pay.gov.sg/payments/ZbzTvadjmP0wd7RRxhWtj',
  return_url: 'https://open.gov.sg',
  reference_id: 'PAYMENT_001',
  latest_status: 'unpaid',
  payer_address: 'Blk 123, Yishun Avenue 2, #08-88, Singapore 123456',
  refund_status: 'not_refunded',
  payment_status: 'unpaid',
  amount_in_cents: 1130,
  payer_identifier: 'S1234567A',
  paid_out_timestamp: null as null,
  payment_service_id: 'payment_service_xxx',
  email_delivery_status: 'unsent',
  payment_sent_timestamp: null as null,
  stripe_payment_intent_id: 'pi_xxx',
  payment_cancelled_timestamp: null as null,
  payment_succeeded_timestamp: null as null,
  payment_fully_refunded_timestamp: null as null,
  // this is not documented
  payment_qr_code_url: 'https://test3.local',
}
