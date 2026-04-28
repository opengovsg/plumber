import { IRawAction } from '@plumber/types'

import Step from '@/models/step'

import { throwAisayDeprecationError } from '../../common/throw-aisay-deprecation-error'

const action: IRawAction = {
  name: 'Extract data from all document types',
  key: 'useGeneralisedModel',
  description: 'Optimised for standard and non-standard documents',
  arguments: [
    {
      label: 'Model type',
      key: 'modelType',
      type: 'dropdown',
      required: true,
      variables: false,
      showOptionValue: false,
      options: [
        { label: 'Standard', value: 'standard' }, // LLM
        { label: 'Vision', value: 'DOC_EXTRACTION_V2' }, // VLM
      ],
      value: 'standard',
    },
    {
      label: 'File',
      key: 'file',
      type: 'dropdown',
      required: true,
      variables: true,
      variableTypes: ['file'],
    },
    {
      label: 'Prompts',
      description:
        'Enter prompts to specify how the data should be interpreted and extracted',
      key: 'prompts',
      type: 'multirow' as const,
      required: true,
      variables: true,
      addRowButtonText: 'Add prompt',
      subFields: [
        {
          placeholder: 'E.g. Return the price of individual line items',
          key: 'prompt',
          type: 'string' as const,
          required: true,
          variables: false,
        },
      ],
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
