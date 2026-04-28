import { IApp } from '@plumber/types'

function addAuthenticationSteps(app: IApp): IApp {
  if (app.auth.generateAuthUrl) {
    app.auth.authenticationSteps = authenticationStepsWithAuthUrl
  } else {
    app.auth.authenticationSteps = authenticationStepsWithoutAuthUrl
  }

  return app
}

const authenticationStepsWithoutAuthUrl = [
  {
    type: 'mutation' as const,
    name: 'createConnection',
    arguments: [
      {
        name: 'key',
        value: '{key}',
      },
      {
        name: 'formattedData',
        value: '{fields.all}',
      },
      {
        name: 'flowId',
        value: '{flowId}',
      },
    ],
  },
  {
    type: 'mutation' as const,
    name: 'verifyConnection',
    arguments: [
      {
        name: 'id',
        value: '{createConnection.id}',
      },
      {
        name: 'flowId',
        value: '{flowId}',
      },
    ],
  },
]

const authenticationStepsWithAuthUrl = [
  {
    type: 'mutation' as const,
    name: 'createConnection',
    arguments: [
      {
        name: 'key',
        value: '{key}',
      },
      {
        name: 'formattedData',
        value: '{fields.all}',
      },
      {
        name: 'flowId',
        value: '{flowId}',
      },
    ],
  },
  {
    type: 'mutation' as const,
    name: 'generateAuthUrl',
    arguments: [
      {
        name: 'id',
        value: '{createConnection.id}',
      },
      {
        name: 'flowId',
        value: '{flowId}',
      },
    ],
  },
  {
    type: 'openWithPopup' as const,
    name: 'openAuthPopup',
    arguments: [
      {
        name: 'url',
        value: '{generateAuthUrl.url}',
      },
    ],
  },
  {
    type: 'mutation' as const,
    name: 'updateConnection',
    arguments: [
      {
        name: 'id',
        value: '{createConnection.id}',
      },
      {
        name: 'formattedData',
        value: '{openAuthPopup.all}',
      },
      {
        name: 'flowId',
        value: '{flowId}',
      },
    ],
  },
  {
    type: 'mutation' as const,
    name: 'verifyConnection',
    arguments: [
      {
        name: 'id',
        value: '{createConnection.id}',
      },
      {
        name: 'flowId',
        value: '{flowId}',
      },
    ],
  },
]

export default addAuthenticationSteps
