import type { IApp } from '@plumber/types'

import actions from './actions'
import auth from './auth'

//
// *DOCCENTRAL GUIDE*
// This is the core app definition object. It's basically an object specifying
// app details such as its name, as well as callbacks for the various actions or
// triggers that the app provides.
//
const app: IApp = {
  name: 'docCentral',
  key: 'doccentral',
  baseUrl: 'https://doccentral.e01.app.gov.sg',

  // *DOCCENTRAL GUIDE*
  // Place your icon in the assets folder!
  iconUrl: '{BASE_URL}/apps/doccentral/assets/favicon.svg',

  // *DOCCENTRAL GUIDE*
  // Change this link if you want to point to a specific page in your guide.
  authDocUrl: 'https://doccentral.e01.app.gov.sg/docs/guide',

  // *DOCCENTRAL GUIDE*
  // Change this to the base URL of your API endpoint.
  apiBaseUrl: 'https://doccentral.e01.app.gov.sg/api/v1',

  // *DOCCENTRAL GUIDE*
  // This `auth` property tells Plumber that users need to configure sensitive
  // data when using your action (e.g. inputting API keys). See `auth/index.ts`
  // file for more information.
  auth,

  // *DOCCENTRAL GUIDE*
  // You can ignore the stuff below...
  actions,

  primaryColor: '000000',
}

export default app
