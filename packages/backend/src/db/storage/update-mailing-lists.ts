import type { Template } from '@/graphql/__generated__/types.generated'

import {
  FORMSG_SAMPLE_URL_DESCRIPTION,
  TILES_SAMPLE_URL_DESCRIPTION,
} from './constants'

const UPDATE_MAILING_LISTS_ID = '8ec2728a-6e4a-49c7-8721-ef6d4eb1d946'

export const UPDATE_MAILING_LISTS_TEMPLATE: Template = {
  id: UPDATE_MAILING_LISTS_ID,
  name: 'Update mailing lists',
  description: 'Maintain mailing lists with updated recipient information',
  iconName: 'BiListUl',
  // Steps: formsg --> find tile row --> update tile row
  steps: [
    {
      position: 1,
      appKey: 'formsg',
      eventKey: 'newSubmission',
      sampleUrl: 'https://form.gov.sg/66c2cf038ff0ca00daca1c6f',
      sampleUrlDescription: FORMSG_SAMPLE_URL_DESCRIPTION,
    },
    {
      position: 2,
      appKey: 'tiles',
      eventKey: 'findSingleRow',
      sampleUrl:
        'https://plumber.gov.sg/tiles/ba2150f6-14d5-44cf-8a77-083c18f43518/c6b75dfa-9fa9-494c-b027-773da38ebaff',
      sampleUrlDescription: TILES_SAMPLE_URL_DESCRIPTION,
      tileTemplateStepData: [
        {
          columnName: 'Name',
          value: 'Anna Lee',
          operator: 'equals',
        },
      ],
    },
    {
      position: 3,
      appKey: 'tiles',
      eventKey: 'updateSingleRow',
      parameters: {
        rowId: '{{Replace with row id result from step 2}}',
      },
      tileTemplateStepData: [
        {
          columnName: 'Email',
          cellValue: '{{Replace with email result from step 2}}',
        },
        {
          columnName: 'Mobile number',
          cellValue: '{{Replace with response 4 mobile number from step 1}}',
        },
      ],
    },
  ],
  tileTemplateData: {
    name: 'Mailing list',
    columns: [
      { name: 'Name', position: 0 },
      { name: 'Email', position: 1 },
      { name: 'Mobile number', position: 2 },
    ],
    rowData: [
      {
        Name: 'Anna Lee',
        Email: 'anna_lee@email.com',
        'Mobile number': '+6598625072',
      },
      {
        Name: 'Susan Tan Jia Ling',
        Email: 'susan_tjl@email.com',
      },
      {
        Name: 'Jane Lim',
        Email: 'jane_98@email.com',
      },
      {
        Name: 'Amy Low',
        Email: 'amy_low_ll@email.com',
      },
      {
        Name: 'Judy Ng',
        Email: 'judy_00@email.com',
      },
    ],
  },
}
