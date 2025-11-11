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

export type AiFormIdea = {
  label: string
  icon: string
  trigger: string
  actions: string
}

export const AI_CHAT_IDEAS = [
  {
    label: 'Route support enquiries',
    icon: 'BiDirections',
    input:
      'When a new support enquiry is submitted, if the query is related to IT, route to the IT department. If the query is related to HR, route to the HR department. If the query is related to Finance, route to the Finance department.',
  },
  {
    label: 'Schedule reminders',
    icon: 'BiCalendar',
    input:
      'Every day at 09:00 AM, find rows in Tiles where the RSVPed column is Yes and the Reminder sent column is empty. For each row, send a reminder email to the attendee. Mark the row as Reminder sent.',
  },
  {
    label: 'Attendance taking',
    icon: 'BiCheckDouble',
    input:
      "When a new event attendance is received, find the attendee in Tiles. If the attendee is found, update the Attended? column to Yes. If the attendee is not found, create a new row in Tiles with the attendee's details.",
  },
  {
    label: 'Send follow ups',
    icon: 'BiEnvelope',
    input:
      'When a new form submission is received, send a follow up email to the customer.',
  },
]

export type AiChatIdea = {
  label: string
  icon: string
  input: string
}
