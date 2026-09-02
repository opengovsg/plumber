export const SUPPORT_FORM_URL_PLACEHOLDER = '{{SUPPORT_FORM_URL}}'

const SUPPORT_FORM_BASE_URL = 'https://form.gov.sg/64929532701266001209ac32'
const SUPPORT_FORM_CHAT_ID_FIELD = '6a979221b8ae314641032f5c'

export function buildSupportFormUrl(chatId: string | undefined): string {
  if (!chatId) {
    return SUPPORT_FORM_BASE_URL
  }

  const params = new URLSearchParams({ [SUPPORT_FORM_CHAT_ID_FIELD]: chatId })
  return `${SUPPORT_FORM_BASE_URL}?${params.toString()}`
}
