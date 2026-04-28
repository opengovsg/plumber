import { IRawAction } from '@plumber/types'

import Step from '@/models/step'

import { throwAisayDeprecationError } from '../../common/throw-aisay-deprecation-error'

const action: IRawAction = {
  name: 'Extract data from specific document types',
  key: 'useSpecificModel',
  description:
    'Optimised for bank statements, invoices, cheques, passports and receipts.',
  arguments: [
    {
      label: 'File',
      key: 'file',
      type: 'dropdown',
      required: true,
      variables: true,
      variableTypes: ['file'],
    },
    {
      label: 'Document type',
      key: 'documentType',
      type: 'dropdown',
      options: [
        { label: 'Bank statement', value: 'BANK_STATEMENT' },
        { label: 'Cheque', value: 'CHEQUE' },
        { label: 'Invoice', value: 'INVOICE' },
        { label: 'Passport', value: 'PASSPORT' },
        { label: 'Receipt', value: 'RECEIPT' },
      ],
      showOptionValue: false,
      required: true,
    },
  ],
  doesFileProcessing: (step: Step) => {
    return step.parameters.file && step.parameters.file !== ''
  },
  async run(_) {
    throwAisayDeprecationError()
  },
} satisfies IRawAction

export default action
