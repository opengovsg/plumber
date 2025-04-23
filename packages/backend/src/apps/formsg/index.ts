import type { IApp } from '@plumber/types'

import beforeRequest from './common/before-request'
import auth from './auth'
import triggers from './triggers'

const app: IApp = {
  name: 'FormSG',
  key: 'formsg',
  description: 'Workflow starts when a new form response is received',
  iconUrl: '{BASE_URL}/apps/formsg/assets/favicon.svg',
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/triggers/formsg',
  baseUrl: 'https://form.gov.sg',
  apiBaseUrl: '',
  primaryColor: '635bff',
  beforeRequest,
  auth,
  triggers,
  actions: [],
  substepLabels: {
    settingsStepLabel: 'Other settings',
  },
  demoVideoDetails: {
    url: 'https://demo.arcade.software/6cWULLTHkTH4XsSB1rs1?embed&show_copy_link=true',
    title: 'Setting up FormSG',
  },
}

export default app
