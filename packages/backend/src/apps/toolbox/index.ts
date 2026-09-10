import { IApp } from '@plumber/types'

import actions from './actions'
import { stepTransformer } from './common/transform-step-parameters'

const app: IApp = {
  name: 'Toolbox',
  key: 'toolbox',
  iconUrl: '{BASE_URL}/apps/toolbox/assets/favicon.svg',
  authDocUrl: 'https://guide.plumber.gov.sg/user-guides/actions/toolbox',
  baseUrl: '',
  apiBaseUrl: '',
  primaryColor: '000000',
  actions,
  stepTransformer,
  description:
    "Use Plumber's built in tools like If-then and Only continue if to add more functionality to your pipes",
  category: 'logic',
}

export default app
