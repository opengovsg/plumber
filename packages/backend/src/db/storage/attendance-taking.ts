import type { Template } from '@/graphql/__generated__/types.generated'

import {
  FORMSG_SAMPLE_URL_DESCRIPTION,
  TILE_COL_DATA_PLACEHOLDER,
  TILE_ID_PLACEHOLDER,
  TILES_SAMPLE_URL_DESCRIPTION,
} from './constants'

const ATTENDANCE_TAKING_ID = '04f95a37-46fe-455b-aa96-28c421379e1a'

export const ATTENDANCE_TAKING_TEMPLATE: Template = {
  id: ATTENDANCE_TAKING_ID,
  name: 'Attendance taking',
  description: 'Track attendance for your event',
  iconName: 'BiCheckDouble',
  tag: 'empty',
  // Steps: formsg --> find tile row --> update tile row
  steps: [
    {
      position: 1,
      appKey: 'formsg',
      eventKey: 'newSubmission',
      sampleUrl: 'https://form.gov.sg/66c2c58c0ebf8abcb0ad4c76',
      sampleUrlDescription: FORMSG_SAMPLE_URL_DESCRIPTION,
    },
    {
      position: 2,
      appKey: 'tiles',
      eventKey: 'findSingleRow',
      sampleUrl:
        'https://plumber.gov.sg/tiles/c77bc8fc-e1ca-4300-a50d-7f2933b9e5b4/a4ca3902-f0ef-41e1-9f5d-45c602c04d50',
      sampleUrlDescription: TILES_SAMPLE_URL_DESCRIPTION,
      parameters: {
        filters: [
          {
            columnId: `{{${TILE_COL_DATA_PLACEHOLDER}.Email}}`,
            value: 'jane@email.com',
            operator: 'equals',
          },
        ],
        returnLastRow: true,
        tableId: `{{${TILE_ID_PLACEHOLDER}}}`,
      },
    },
    {
      position: 3,
      appKey: 'tiles',
      eventKey: 'updateSingleRow',
      parameters: {
        rowId: '{{Replace with row id result from step 2}}',
        rowData: [
          {
            columnId: `{{${TILE_COL_DATA_PLACEHOLDER}.Attended?}}`,
            cellValue: 'Yes',
          },
        ],
        tableId: `{{${TILE_ID_PLACEHOLDER}}}`,
      },
    },
  ],
  tileTemplateData: {
    name: 'Event attendance',
    columns: [
      { name: 'Name', position: 0 },
      { name: 'Email', position: 1 },
      { name: 'Attended?', position: 2 },
    ],
    rowData: [
      {
        Name: 'Jane Doe',
        Email: 'jane@email.com',
        'Attended?': 'No',
      },
      {
        Name: 'John Doe',
        Email: 'john@email.com',
        'Attended?': 'Yes',
      },
    ],
  },
}
