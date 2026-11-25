import { getEnvironmentConfig } from './environments'

const environment = getEnvironmentConfig()
export const E2E_ENV = environment.environment
export const BASE_URL = environment.baseUrl
export const PIPE_IDS = environment.pipes
export const AUTH_STATE_FILE = environment.authStateFile
export const MAILBOX = process.env.MAILBOX || 'internal-testing@open.gov.sg'
export const MAILSENDER = process.env.MAILSENDER || 'info@plumber.gov.sg'
export const TRIGGER_FORM_ID =
  process.env.TRIGGER_FORM_ID || environment.forms.trigger
export const TRIGGER_MRF_FORM_ID =
  process.env.TRIGGER_MRF_FORM_ID || environment.forms.mrf

export const GATHERSG_TRIGGER_FORM_ID =
  process.env.GATHERSG_TRIGGER_FORM_ID || environment.forms.gathersg
export const GATHERSG_EMAIL_TRIGGER_FORM_ID =
  process.env.GATHERSG_EMAIL_TRIGGER_FORM_ID || environment.forms.gathersgEmail
export const GATHERSG_CONNECTION_NAME =
  process.env.GATHERSG_CONNECTION_NAME || 'Plumber e2e'

if (!process.env.GMAIL_CREDENTIALS) {
  throw new Error('GMAIL_CREDENTIALS not found in env')
}

if (!process.env.GMAIL_TOKEN) {
  throw new Error('GMAIL_TOKEN not found in env')
}

if (!process.env.GATHERSG_API_KEY) {
  throw new Error('GATHERSG_API_KEY not found in env')
}

export const GATHERSG_API_KEY = process.env.GATHERSG_API_KEY
export const GMAIL_CREDENTIALS = JSON.parse(process.env.GMAIL_CREDENTIALS)
export const GMAIL_TOKEN = JSON.parse(process.env.GMAIL_TOKEN)

export const WEBHOOK_TESTER_HOSTNAME = environment.webhookTesterHostname

export const AUTH_FILE_ENCRYPTION_SECRET =
  process.env.AUTH_FILE_ENCRYPTION_SECRET || 'secret'
