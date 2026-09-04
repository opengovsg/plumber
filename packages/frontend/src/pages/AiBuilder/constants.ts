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

export const PLACEHOLDER_MESSAGE =
  "Describe the task and we'll build it for you, or ask a question"

// Maximum number of messages allowed in a conversation (hard limit).
// Keep in sync with backend/src/routes/api/chat/{schema,index}.ts.
export const MAX_MESSAGES = 150

// Support form URL, pre-filled with the chat ID for tracing. Keep in sync with
// backend/src/helpers/ai/build-support-form-url.ts.
export const SUPPORT_FORM_BASE_URL =
  'https://form.gov.sg/64929532701266001209ac32'
export const SUPPORT_FORM_CHAT_ID_FIELD = '6a979221b8ae314641032f5c'

// App keys that support AI Builder's generic in-chat "add connection" flow
// (secret-key or OAuth-via-popup apps, driven entirely by each app's
// auth.fields/auth.authenticationSteps — see components/AddAppConnection).
// FormSG is handled separately by AddFormsgConnectionModal and is
// intentionally not in this list. Databricks and M365-Excel are
// system-added (no user-entered fields) and are out of scope for this list.
export const AI_BUILDER_INLINE_CONNECT_APP_KEYS = [
  'lettersg',
  'gathersg',
  'paysg',
  'postman-sms',
  'telegram-bot',
  'slack',
] as const

export type AiBuilderInlineConnectAppKey =
  (typeof AI_BUILDER_INLINE_CONNECT_APP_KEYS)[number]
