import type { ITemplate } from '@plumber/types'

import {
  CREATE_TEMPLATE_STEP_VARIABLE,
  FORMSG_SAMPLE_URL_DESCRIPTION,
  TILE_COL_DATA_PLACEHOLDER,
  TILE_ID_PLACEHOLDER,
  TILES_SAMPLE_URL_DESCRIPTION,
} from './constants'

const UPDATE_MAILING_LISTS_ID = 'a03f3914-bbbf-43b0-8385-c6934362cce8'

export const UPDATE_MAILING_LISTS_TEMPLATE: ITemplate = {
  id: UPDATE_MAILING_LISTS_ID,
  name: 'Update mailing lists',
  description:
    'Maintain mailing lists and keep them updated with the latest recipient information',
  iconName: 'BiListUl',
  // Steps: formsg --> find tile row --> if-then condition --> create or update tile row
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
      parameters: {
        filters: [
          {
            columnId: TILE_COL_DATA_PLACEHOLDER('Name'),
            value: CREATE_TEMPLATE_STEP_VARIABLE('Replace with name response'),
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
        branchName: 'Officer has not signed up for the mailing list',
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
            columnId: TILE_COL_DATA_PLACEHOLDER('Mobile number'),
            cellValue: CREATE_TEMPLATE_STEP_VARIABLE(
              'Replace with mobile number response',
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
        branchName: 'Officer has signed up for the mailing list',
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
            columnId: TILE_COL_DATA_PLACEHOLDER('Name'),
            cellValue: CREATE_TEMPLATE_STEP_VARIABLE(
              'Replace with name response',
            ),
          },
          {
            columnId: TILE_COL_DATA_PLACEHOLDER('Mobile number'),
            cellValue: CREATE_TEMPLATE_STEP_VARIABLE(
              'Replace with mobile number response',
            ),
          },
        ],
        tableId: TILE_ID_PLACEHOLDER,
      },
    },
  ],
  tileTemplateData: {
    name: 'Mailing list',
    columns: ['Email', 'Name', 'Mobile number'],
    rowData: [
      {
        Email: 'anna_lee@email.com',
        Name: 'Anna Lee',
        'Mobile number': '+6598625072',
      },
      {
        Email: 'susan_tjl@email.com',
        Name: 'Susan Tan Jia Ling',
      },
      {
        Email: 'jane_98@email.com',
        Name: 'Jane Lim',
      },
      {
        Email: 'amy_low_ll@email.com',
        Name: 'Amy Low',
      },
      {
        Email: 'judy_00@email.com',
        Name: 'Judy Ng',
      },
    ],
  },
}
