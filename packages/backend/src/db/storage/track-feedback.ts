import type { ITemplate } from '@plumber/types'

import {
  FORMSG_SAMPLE_URL_DESCRIPTION,
  TILE_COL_DATA_PLACEHOLDER,
  TILE_ID_PLACEHOLDER,
  TILES_SAMPLE_URL_DESCRIPTION,
} from './constants'

const TRACK_FEEDBACK_ID = 'b237ff81-dbe9-4513-8135-0b59eec2de97'

export const TRACK_FEEDBACK_TEMPLATE: ITemplate = {
  id: TRACK_FEEDBACK_ID,
  name: 'Track feedback',
  description:
    'Store survey feedback in a table and share it with your team by generating a link to it.',
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
      parameters: {
        rowData: [
          {
            columnId: `{{${TILE_COL_DATA_PLACEHOLDER}.Rating}}`,
            cellValue: '{{Replace with response 1 rating}}',
          },
          {
            columnId: `{{${TILE_COL_DATA_PLACEHOLDER}.Reason for rating}}`,
            cellValue: '{{Replace with response 2 reason}}',
          },
          {
            columnId: `{{${TILE_COL_DATA_PLACEHOLDER}.Email}}`,
            cellValue: '{{Replace with response 3 email}}',
          },
        ],
        tableId: `{{${TILE_ID_PLACEHOLDER}}}`,
      },
    },
  ],
  tileTemplateData: {
    name: 'Event feedback',
    columns: ['Rating', 'Reason for rating', 'Email'],
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
