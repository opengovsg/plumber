import type { Template } from '@/graphql/__generated__/types.generated'

const ATTENDANCE_TAKING_ID = '04f95a37-46fe-455b-aa96-28c421379e1a'

export const ATTENDANCE_TAKING_TEMPLATE: Template = {
  id: ATTENDANCE_TAKING_ID,
  name: 'Attendance taking',
  description: 'Track attendance for your event',
  // Steps: formsg --> find tile row --> update tile row
  steps: [
    {
      position: 1,
      templateId: ATTENDANCE_TAKING_ID,
      appKey: 'formsg',
      eventKey: 'newSubmission',
      sampleUrl: 'https://form.gov.sg/66c2c58c0ebf8abcb0ad4c76',
    },
    {
      position: 2,
      templateId: ATTENDANCE_TAKING_ID,
      appKey: 'tiles',
      eventKey: 'findSingleRow',
      sampleUrl:
        'https://plumber.gov.sg/tiles/c77bc8fc-e1ca-4300-a50d-7f2933b9e5b4/a4ca3902-f0ef-41e1-9f5d-45c602c04d50',
    },
    {
      position: 3,
      templateId: ATTENDANCE_TAKING_ID,
      appKey: 'tiles',
      eventKey: 'updateSingleRow',
    },
  ],
}
