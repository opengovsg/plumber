import type { IDataOutMetadata, IExecutionStep } from '@plumber/types'

import { dataOutSchema } from './schemas'

async function getDataOutMetadata(
  executionStep: IExecutionStep,
): Promise<IDataOutMetadata> {
  const { dataOut: rawDataOut } = executionStep
  if (!rawDataOut) {
    return null
  }

  const dataOut = dataOutSchema.parse(rawDataOut)

  const metadata: IDataOutMetadata = {
    rowsFound: {
      label: 'Number of rows found',
      order: 2,
    },
    data: {
      label: 'List of row(s) found',
      displayedValue: `Preview ${dataOut.rowsFound} row(s)`,
      type: 'table',
      order: 1,
    },
  }

  return { ...metadata }
}

export default getDataOutMetadata

// Example dataOut:
// {
//   "data": {
//     "rows": [
//       {
//         "data": {
//           "4e524943": "S7032796N",
//           "41646472657373": "Block 161 Victoria Street #41-21",
//           "525356502d6564": "Yes",
//           "4164647265737332": "",
//           "4c617374204e616d65": "Lee",
//           "4669727374204e616d65": "Jane",
//           "506f7374616c20436f6465": "753105",
//           "4e657720436f6c756d6e2033": "2025-04-07T10:19:39.920Z",
//           "4e657720436f6c756d6e2034": "400",
//           "456d61696c2041646472657373": "meiling.lee179@gmail.com",
//           "456d61696c204164647265737332": ""
//         }
//       },
//       {
//         "data": {
//           "4e524943": "S2645644U",
//           "41646472657373": "Block 535 Bedok North Road #38-325",
//           "525356502d6564": "Yes",
//           "4164647265737332": "",
//           "4c617374204e616d65": "Abdullah",
//           "4669727374204e616d65": "Ivan",
//           "506f7374616c20436f6465": "557687",
//           "4e657720436f6c756d6e2033": "",
//           "4e657720436f6c756d6e2034": "",
//           "456d61696c2041646472657373": "",
//           "456d61696c204164647265737332": ""
//         }
//       }
//     ],
//     "columns": [
//       {
//         "id": "525356502d6564",
//         "name": "RSVP-ed",
//         "value": "data.rows.*.data.525356502d6564"
//       },
//       {
//         "id": "4669727374204e616d65",
//         "name": "First Name",
//         "value": "data.rows.*.data.4669727374204e616d65"
//       },
//       {
//         "id": "4c617374204e616d65",
//         "name": "Last Name",
//         "value": "data.rows.*.data.4c617374204e616d65"
//       },
//       {
//         "id": "4e524943",
//         "name": "NRIC",
//         "value": "data.rows.*.data.4e524943"
//       },
//       {
//         "id": "41646472657373",
//         "name": "Address",
//         "value": "data.rows.*.data.41646472657373"
//       },
//       {
//         "id": "506f7374616c20436f6465",
//         "name": "Postal Code",
//         "value": "data.rows.*.data.506f7374616c20436f6465"
//       },
//       {
//         "id": "456d61696c2041646472657373",
//         "name": "Email Address",
//         "value": "data.rows.*.data.456d61696c2041646472657373"
//       },
//       {
//         "id": "456d61696c204164647265737332",
//         "name": "Email Address2",
//         "value": "data.rows.*.data.456d61696c204164647265737332"
//       },
//       {
//         "id": "4164647265737332",
//         "name": "Address2",
//         "value": "data.rows.*.data.4164647265737332"
//       },
//       {
//         "id": "4e657720436f6c756d6e2033",
//         "name": "New Column 3",
//         "value": "data.rows.*.data.4e657720436f6c756d6e2033"
//       },
//       {
//         "id": "4e657720436f6c756d6e2034",
//         "name": "New Column 4",
//         "value": "data.rows.*.data.4e657720436f6c756d6e2034"
//       }
//     ]
//   },
//   "rowsFound": 6
// }
