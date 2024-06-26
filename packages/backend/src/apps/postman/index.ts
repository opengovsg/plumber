import { IApp } from '@plumber/types'

import actions from './actions'

const app: IApp = {
  name: 'Email by Postman',
  key: 'postman',
  iconUrl: '{BASE_URL}/apps/postman/assets/favicon.svg',
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/actions/postman',
  baseUrl: 'https://postman.gov.sg',
  apiBaseUrl: 'https://api.postman.gov.sg',
  primaryColor: '000000',
  actions,
  substepLabels: {
    settingsStepLabel: 'Set up email',
  },
  demoVideoDetails: {
    url: 'https://demo.arcade.software/VppMAbGKfFXFEsKxnKiw?embed&show_copy_link=true',
    title: 'Setting up Email by Postman',
  },
  priority: 1,
}

export default app
