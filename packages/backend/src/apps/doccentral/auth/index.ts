import { IUserAddedConnectionAuth } from '@plumber/types'

import isStillVerified from './is-still-verified'
import verifyCredentials from './verify-credentials'

//
// *DOCCENTRAL GUIDE*
// This tells Plumber that users to input sensitive data (e.g. API keys) when
// they are setting up your action.
//
// Each `field` shows up as a connection form field in Plumber (e.g. look at
// fields specified in `apps/paysg/auth/index.ts` and try creating a connection
// in Plumber's PaySG app).
//
// The data input by the user in these fields are encrypted in Plumber's
// database. It is also accessible in an action's code via `$.auth.data.<fieldName>`
// (e.g. to access the `apiKey` field in your action's run() callback, access
// `$.auth.apiKey`).
//
const auth: IUserAddedConnectionAuth = {
  connectionType: 'user-added' as const,

  fields: [
    {
      key: 'screenName',
      label: 'Label',
      type: 'string' as const,
      required: true,
      readOnly: false,
    },
    {
      key: 'apiKey',
      label: 'API key',
      type: 'string' as const,
      required: true,
      readOnly: false,
      clickToCopy: false,
      autoComplete: 'off' as const,
    },
  ],

  // *DOCCENTRAL GUIDE*
  // These are callbacks that allow you to verify the data entered by the user
  // for the fields above.
  verifyCredentials,
  isStillVerified,
}

export default auth
