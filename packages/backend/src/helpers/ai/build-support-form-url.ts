export const SUPPORT_FORM_URL_PLACEHOLDER = '{{SUPPORT_FORM_URL}}'

// TODO: fill in the real form.gov.sg support form URL and chat-ID field ID.
const SUPPORT_FORM_BASE_URL = 'TODO_SUPPORT_FORM_BASE_URL'
const SUPPORT_FORM_CHAT_ID_FIELD = 'TODO_SUPPORT_FORM_CHAT_ID_FIELD'

export function buildSupportFormUrl(chatId: string | undefined): string {
  if (!chatId) {
    return SUPPORT_FORM_BASE_URL
  }

  const params = new URLSearchParams({ [SUPPORT_FORM_CHAT_ID_FIELD]: chatId })
  return `${SUPPORT_FORM_BASE_URL}?${params.toString()}`
}
