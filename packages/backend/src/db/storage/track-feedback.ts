import type { Template } from '@/graphql/__generated__/types.generated'

import {
  FORMSG_SAMPLE_URL_DESCRIPTION,
  TILES_SAMPLE_URL_DESCRIPTION,
} from './constants'

const TRACK_FEEDBACK_ID = 'b237ff81-dbe9-4513-8135-0b59eec2de97'

export const TRACK_FEEDBACK_TEMPLATE: Template = {
  id: TRACK_FEEDBACK_ID,
  name: 'Track feedback',
  description:
    'Store survey feedback in a table. Share this table with your team.',
  iconName: 'BiStar',
  // Steps: formsg --> create tile
  steps: [
    {
      position: 1,
      appKey: 'formsg',
      eventKey: 'newSubmission',
      sampleUrl: 'https://form.gov.sg/66c2d2ea69c2121a425975bc',
      sampleUrlDescription: FORMSG_SAMPLE_URL_DESCRIPTION,
    },
    {
      position: 2,
      appKey: 'tiles',
      eventKey: 'createTileRow',
      sampleUrl:
        'https://plumber.gov.sg/tiles/18a72737-4a7e-4f90-8bb5-7d65bdac4136/d6f806c0-eb80-451b-872d-6e9a3d434ab2',
      sampleUrlDescription: TILES_SAMPLE_URL_DESCRIPTION,
      tileTemplateStepData: [
        {
          columnName: 'Rating',
          cellValue: '{{Replace with response 1 rating}}',
        },
        {
          columnName: 'Reason for rating',
          cellValue: '{{Replace with response 2 reason}}',
        },
        {
          columnName: 'Email',
          cellValue: '{{Replace with response 3 email}}',
        },
      ],
    },
  ],
  tileTemplateData: {
    name: 'Event feedback',
    columns: [
      { name: 'Rating', position: 0 },
      { name: 'Reason for rating', position: 1 },
      { name: 'Email', position: 2 },
    ],
    rowData: [
      {
        Rating: '4',
        'Reason for rating':
          'Plumber is good, please continue to make it better!',
        Email: 'support@plumber.gov.sg',
      },
    ],
  },
}
