import type { Template } from '@/graphql/__generated__/types.generated'

const UPDATE_MAILING_LISTS_ID = '8ec2728a-6e4a-49c7-8721-ef6d4eb1d946'

export const UPDATE_MAILING_LISTS_TEMPLATE: Template = {
  id: UPDATE_MAILING_LISTS_ID,
  name: 'Update mailing lists',
  description: 'Maintain mailing lists with updated recipient information',
  // Steps: formsg --> find tile row --> update tile row
  steps: [
    {
      position: 1,
      templateId: UPDATE_MAILING_LISTS_ID,
      appKey: 'formsg',
      eventKey: 'newSubmission',
      sampleUrl: 'https://form.gov.sg/66c2cf038ff0ca00daca1c6f',
    },
    {
      position: 2,
      templateId: UPDATE_MAILING_LISTS_ID,
      appKey: 'tiles',
      eventKey: 'findSingleRow',
      sampleUrl:
        'https://plumber.gov.sg/tiles/ba2150f6-14d5-44cf-8a77-083c18f43518/c6b75dfa-9fa9-494c-b027-773da38ebaff',
    },
    {
      position: 3,
      templateId: UPDATE_MAILING_LISTS_ID,
      appKey: 'tiles',
      eventKey: 'updateSingleRow',
    },
  ],
}
