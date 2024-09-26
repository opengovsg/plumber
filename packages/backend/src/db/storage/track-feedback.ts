import type { Template } from '@/graphql/__generated__/types.generated'

const TRACK_FEEDBACK_ID = 'b237ff81-dbe9-4513-8135-0b59eec2de97'

export const TRACK_FEEDBACK_TEMPLATE: Template = {
  id: TRACK_FEEDBACK_ID,
  name: 'Track feedback',
  description:
    'Store survey feedback in a table. Share this table with your team.',
  // Steps: formsg --> create tile
  steps: [
    {
      position: 1,
      appKey: 'formsg',
      eventKey: 'newSubmission',
      sampleUrl: 'https://form.gov.sg/66c2d2ea69c2121a425975bc',
    },
    {
      position: 2,
      appKey: 'tiles',
      eventKey: 'createTileRow',
      sampleUrl:
        'https://plumber.gov.sg/tiles/18a72737-4a7e-4f90-8bb5-7d65bdac4136/d6f806c0-eb80-451b-872d-6e9a3d434ab2',
    },
  ],
}
