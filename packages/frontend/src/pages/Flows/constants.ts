export const AI_FORM_FIELDS = [
  {
    key: 'actions' as const,
    label: 'What should this workflow accomplish?',
    placeholder:
      'This workflow should help me to collect attendance for my event.',
    required: true,
    resize: 'vertical' as const,
    minH: '100px',
    maxH: '200px',
  },
  {
    key: 'trigger' as const,
    label: 'Where does your data come from?',
    placeholder: 'FormSG',
    required: true,
    resize: 'vertical' as const,
    minH: '42px',
    maxH: '126px',
  },
]

export const AI_FORM_IDEAS = [
  {
    label: 'Route support enquiries',
    icon: 'BiDirections',
    trigger: 'FormSG',
    actions:
      'If the query is related to IT, route to the IT department.\nIf the query is related to HR, route to the HR department.\nIf the query is related to Finance, route to the Finance department.',
  },
  {
    label: 'Schedule reminders',
    icon: 'BiCalendar',
    trigger: 'Tiles',
    actions:
      'Every day at 09:00 AM, find rows in Tiles where the RSVPed column is Yes and the Reminder sent column is empty.\nFor each row, send a reminder email to the attendee.\nMark the row as Reminder sent.',
  },
  {
    label: 'Attendance taking',
    icon: 'BiCheckDouble',
    trigger: 'FormSG',
    actions:
      "When a new event attendance is received, find the attendee in Tiles.\nIf the attendee is found, update the Attended? column to Yes.\nIf the attendee is not found, create a new row in Tiles with the attendee's details.",
  },
]
