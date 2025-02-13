export const FORM_ID_LENGTH = 24

/**
 * NOTE: this must be updated if there are any changes to the address fields
 * Currently following the same field names as FormSG
 */
export const ADDRESS_LABELS = [
  'Block number',
  'Street name',
  'Building name',
  // this combines level number and unit number
  'Unit number',
  'Postal code',
]

// Reference form response for local address
// ---
// {
//   question: 'Local address',
//   fieldType: 'address',
//   answerArray: [ '51', 'BRAS BASAH ROAD', 'Lazada One', '8', '8888', '189554' ]
// }
