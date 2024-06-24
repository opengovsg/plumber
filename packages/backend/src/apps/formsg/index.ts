import { IApp } from '@plumber/types'

import auth from './auth'
import triggers from './triggers'

const app: IApp = {
  name: 'FormSG',
  key: 'formsg',
  iconUrl: '{BASE_URL}/apps/formsg/assets/favicon.svg',
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/triggers/formsg',
  baseUrl: 'https://form.gov.sg',
  apiBaseUrl: 'https://form.gov.sg/api',
  primaryColor: '635bff',
  beforeRequest: [],
  auth,
  triggers,
  actions: [],
  substepLabels: {
    connectionStepLabel: 'Connect your form',
    settingsStepLabel: 'Other settings',
    addConnectionLabel: 'Add new form',
  },
  demoVideoDetails: {
    url: 'https://demo.arcade.software/6cWULLTHkTH4XsSB1rs1?embed&show_copy_link=true',
    title: 'Setting up FormSG',
  },
}

export default app
