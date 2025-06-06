export const DOCUMENT_TYPES = [
  'BANK_STATEMENT',
  'CHEQUE',
  'INVOICE',
  'PASSPORT',
  'RECEIPT',
]

export const DEFAULT_GENERALISED_MODEL_TYPE = 'standard'
export const GENERALISED_MODEL_OPTIONS = [
  { label: 'Standard', value: DEFAULT_GENERALISED_MODEL_TYPE },
  { label: 'Vision', value: 'DOC_EXTRACTION_V2' },
]
