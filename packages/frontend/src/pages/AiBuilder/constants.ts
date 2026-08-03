export type AiFormIdea = {
  label: string
  icon: string
  trigger: string
  actions: string
}

export const AI_CHAT_IDEAS = [
  {
    label: 'Send FormSG responses to the right team via email',
    icon: 'BiDirections',
    input:
      'Route FormSG support requests to different teams based on the issue type selected - technical issues go to IT, billing questions to Finance, and general enquiries to Customer Service.',
  },
  {
    label: 'Schedule recurring email reminders',
    icon: 'BiCalendar',
    input:
      'I need to remind supervisors who have pending cases to act on them 3 days before the due date. The pending cases are recorded in a table.',
  },
  {
    label: 'Track event attendance with FormSG',
    icon: 'BiCheckDouble',
    input:
      "When a new event attendance is received, find the attendee in Tiles. If the attendee is found, update the Attended? column to Yes. If the attendee is not found, create a new row in Tiles with the attendee's details.",
  },
]

export type AiChatIdea = {
  label: string
  icon: string
  input: string
}

export const PLACEHOLDER_MESSAGES = [
  'Think in order. What happens first, and what follows',
  "Describe what you have in mind and we'll show you what's possible",
  "Share what you're trying to do and we'll help you figure out the best way to automate it",
]

// Maximum number of messages allowed in a conversation (hard limit)
export const MAX_MESSAGES = 50
