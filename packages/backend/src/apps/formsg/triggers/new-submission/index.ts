import {
  IDataOutMetadata,
  IExecutionStep,
  IGlobalVariable,
} from '@plumber/types'

import isEmpty from 'lodash/isEmpty'

import defineTrigger from '@/helpers/define-trigger'

export const NricFilter = {
  None: 'none',
  Remove: 'remove',
  Mask: 'mask',
  Hash: 'hash',
}

export default defineTrigger({
  name: 'New form submission',
  key: 'newSubmission',
  type: 'webhook',
  description: 'Triggers when the webhook receives a request.',
  arguments: [
    {
      label: 'NRIC Filter',
      key: 'nricFilter',
      type: 'dropdown' as const,
      description: 'Choose how to handle NRIC numbers',
      required: false,
      variables: false,
      value: NricFilter.None,
      options: [
        {
          label: 'No nothing',
          value: NricFilter.None,
        },
        {
          label: 'Remove NRIC numbers',
          value: NricFilter.Remove,
        },
        {
          label: 'Mask NRIC numbers, e.g. S1234567A -> xxxxx567A',
          value: NricFilter.Mask,
        },
        {
          label:
            'Hash NRIC numbers, e.g. S1234567A -> 5f4dcc3b5aa765d61d8327deb882cf99',
          value: NricFilter.Hash,
        },
      ],
    },
  ],

  async testRun($: IGlobalVariable) {
    const lastExecutionStep = await $.getLastExecutionStep()
    if (!isEmpty(lastExecutionStep?.dataOut)) {
      await $.pushTriggerItem({
        raw: lastExecutionStep?.dataOut,
        meta: {
          internalId: '',
        },
      })
    }
  },

  async getDataOutMetadata(
    executionStep: IExecutionStep,
  ): Promise<IDataOutMetadata> {
    const data = executionStep.dataOut
    if (!data) {
      return null
    }

    const fieldMetadata: IDataOutMetadata = Object.create(null)
    for (const [fieldId, fieldData] of Object.entries(data.fields)) {
      fieldMetadata[fieldId] = {
        question: {
          type: 'text',
          isVisible: true,
          label: fieldData.order ? `Question ${fieldData.order}` : null,
          order: fieldData.order ? fieldData.order : null,
        },
        answer: {
          type: 'text',
          isVisible: true,
          label: fieldData.order ? `Response ${fieldData.order}` : null,
          order: fieldData.order ? fieldData.order + 0.1 : null,
        },
        fieldType: { isVisible: false },
        order: { isVisible: false },
      }
    }

    const verifiedMetadata: IDataOutMetadata = Object.create(null)
    if (data.verifiedSubmitterInfo) {
      for (const key of Object.keys(data.verifiedSubmitterInfo)) {
        switch (key) {
          case 'sgidUinFin':
            verifiedMetadata.sgidUinFin = { label: 'NRIC/FIN (Verified)' }
            break
          case 'cpUid':
            verifiedMetadata.cpUid = { label: 'CorpPass UID (Verified)' }
            break
          case 'cpUen':
            verifiedMetadata.cpUen = { label: 'CorpPass UEN (Verified)' }
            break
        }
      }
    }

    return {
      fields: fieldMetadata,
      ...(data.verifiedSubmitterInfo && {
        verifiedSubmitterInfo: verifiedMetadata,
      }),
      submissionId: { isVisible: false },
    }

    // Reference dataOut
    // ---
    // {
    //   fields: {
    //     647edbd2026dc800116b21f9: {
    //       answer: 'zzz',
    //       question: 'What is the air speed velocity of an unladen swallow?',
    //       fieldType: 'textfield'
    //       order: 2
    //     },
    //     648fe18a9175ce001196b3d5: {
    //       answer: 'aaaa',
    //       question: 'What is your name?',
    //       fieldType: 'textfield'
    //       order: 1
    //     }
    //   },
    //   # verifiedSubmitterInfo may not exist!
    //   verifiedSubmitterInfo: {
    //       sgidUinFin: 'S1234567A',
    //       cpUid: 'U987654323PLUMBER',
    //       cpUen: 'S7654321Z',
    //     },
    //   submissionId: '649306c1ac8851001149af0a'
    // }
  },
})
