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
      'I have a FormSG that I am using to track attendance. I need this workflow to track who has signed up and is present. It should also note down if this person is a new registrant.',
  },
  {
    label: 'Schedule reminders',
    icon: 'BiCalendar',
    input:
      'I need to remind supervisors who have pending cases to act on them 3 days before the due date. The pending cases are recorded in a table.',
  },
  {
    label: 'Attendance taking',
    icon: 'BiCheckDouble',
    input:
      'I have a FormSG that I am using to track attendance. I need this workflow to track who has signed up and is present. It should also note down if this person is a new registrant.',
  },
  // {
  //   label: 'Send follow ups',
  //   icon: 'BiEnvelope',
  //   input:
  //     'When a new form submission is received, send a follow up email to the customer.',
  // },
]

export type AiChatIdea = {
  label: string
  icon: string
  input: string
}
