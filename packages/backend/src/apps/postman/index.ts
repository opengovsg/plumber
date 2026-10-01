import { IApp } from '@plumber/types'

import { stepTransformer } from './common/transform-step-parameters'
import actions from './actions'
import queue from './queue'

const app: IApp = {
  name: 'Email by Postman',
  key: 'postman',
  description: 'Send emails via Postman',
  iconUrl: '{BASE_URL}/apps/postman/assets/favicon.svg',
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/actions/postman',
  baseUrl: 'https://postman.gov.sg',
  apiBaseUrl: 'https://api.postman.gov.sg',
  primaryColor: '000000',
  actions,
  demoVideoDetails: {
    url: 'https://demo.arcade.software/VppMAbGKfFXFEsKxnKiw?embed&show_copy_link=true',
    title: 'Setting up Email by Postman',
  },
  queue,
  stepTransformer,
  category: 'communication',
}

export default app
