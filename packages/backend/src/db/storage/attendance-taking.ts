import type { ITemplate } from '@plumber/types'

import {
  CREATE_TEMPLATE_STEP_VARIABLE,
  FORMSG_SAMPLE_URL_DESCRIPTION,
  TILE_COL_DATA_PLACEHOLDER,
  TILE_ID_PLACEHOLDER,
  TILES_SAMPLE_URL_DESCRIPTION,
} from './constants'

const ATTENDANCE_TAKING_ID = '04f95a37-46fe-455b-aa96-28c421379e1a'

export const ATTENDANCE_TAKING_TEMPLATE: ITemplate = {
  id: ATTENDANCE_TAKING_ID,
  name: 'Attendance taking',
  description:
    'Track attendance for your event using a form and a pre-populated table of event participants',
  iconName: 'BiCheckDouble',
  tags: ['empty'],
  // Steps: formsg --> find tile row --> if-then condition --> create or update tile row
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
            columnId: TILE_COL_DATA_PLACEHOLDER('Email'),
            value: CREATE_TEMPLATE_STEP_VARIABLE('Replace with email response'),
            operator: 'equals',
          },
        ],
        returnLastRow: true,
        tableId: TILE_ID_PLACEHOLDER,
      },
    },
    {
      position: 3,
      appKey: 'toolbox',
      eventKey: 'ifThen',
      parameters: {
        depth: 0,
        branchName: 'Registering attendance for the first time',
        conditions: [
          {
            is: 'is',
            text: '0',
            field: CREATE_TEMPLATE_STEP_VARIABLE('rowsFound', 2),
            condition: 'equals',
          },
        ],
      },
    },
    {
      position: 4,
      appKey: 'tiles',
      eventKey: 'createTileRow',
      parameters: {
        rowData: [
          {
            columnId: TILE_COL_DATA_PLACEHOLDER('Email'),
            cellValue: CREATE_TEMPLATE_STEP_VARIABLE(
              'Replace with email response',
            ),
          },
          {
            columnId: TILE_COL_DATA_PLACEHOLDER('Name'),
            cellValue: CREATE_TEMPLATE_STEP_VARIABLE(
              'Replace with name response',
            ),
          },
          {
            columnId: TILE_COL_DATA_PLACEHOLDER('Attending?'),
            cellValue: CREATE_TEMPLATE_STEP_VARIABLE(
              'Replace with attending response',
            ),
          },
        ],
        tableId: TILE_ID_PLACEHOLDER,
      },
    },
    {
      position: 5,
      appKey: 'toolbox',
      eventKey: 'ifThen',
      parameters: {
        depth: 0,
        branchName: 'Updating existing attendance',
        conditions: [
          {
            is: 'not',
            text: '0',
            field: CREATE_TEMPLATE_STEP_VARIABLE('rowsFound', 2),
            condition: 'equals',
          },
        ],
      },
    },
    {
      position: 6,
      appKey: 'tiles',
      eventKey: 'updateSingleRow',
      parameters: {
        rowId: CREATE_TEMPLATE_STEP_VARIABLE('rowId', 2),
        rowData: [
          {
            columnId: TILE_COL_DATA_PLACEHOLDER('Attending?'),
            cellValue: CREATE_TEMPLATE_STEP_VARIABLE(
              'Replace with attending response',
            ),
          },
        ],
        tableId: TILE_ID_PLACEHOLDER,
      },
    },
  ],
  tileTemplateData: {
    name: 'Event attendance',
    columns: ['Email', 'Name', 'Attending?'],
    rowData: [
      {
        Email: 'jane@email.com',
        Name: 'Jane Doe',
        'Attending?': 'No',
      },
      {
        Email: 'john@email.com',
        Name: 'John Doe',
        'Attending?': 'Yes',
      },
    ],
  },
}
