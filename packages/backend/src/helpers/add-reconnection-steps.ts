import {
  IApp,
  IAuthenticationStep,
  IAuthenticationStepField,
} from '@plumber/types'

import cloneDeep from 'lodash/cloneDeep'

const connectionIdArgument = {
  name: 'id',
  value: '{connection.id}',
}

const resetConnectionStep = {
  type: 'mutation' as const,
  name: 'resetConnection',
  arguments: [connectionIdArgument],
}

function replaceCreateConnection(string: string) {
  return string.replace('{createConnection.id}', '{connection.id}')
}

function removeAppKeyArgument(args: IAuthenticationStepField[]) {
  return args.filter((argument) => argument.name !== 'key')
}

function addConnectionId(step: IAuthenticationStep) {
  step.arguments = step.arguments.map((argument) => {
    if (typeof argument.value === 'string') {
      argument.value = replaceCreateConnection(argument.value)
    }

    if (argument.properties) {
      argument.properties = argument.properties.map((property) => {
        return {
          name: property.name,
          value: replaceCreateConnection(property.value),
        }
      })
    }

    return argument
  })

  return step
}

function replaceCreateConnectionsWithUpdate(steps: IAuthenticationStep[]) {
  const updatedSteps = cloneDeep(steps)
  return updatedSteps.map((step) => {
    const updatedStep = addConnectionId(step)

    if (step.name === 'createConnection') {
      updatedStep.name = 'updateConnection'
      updatedStep.arguments = removeAppKeyArgument(updatedStep.arguments)
      updatedStep.arguments.unshift(connectionIdArgument)

      return updatedStep
    }

    return step
  })
}

function addReconnectionSteps(app: IApp): IApp {
  const auth = app.auth
  if (!auth) {
    throw new Error(`Cannot add reconnection steps for app '${app.key}'`)
  }

  if (auth.reconnectionSteps) {
    return app
  }

  const authenticationSteps = auth.authenticationSteps
  if (!authenticationSteps) {
    throw new Error(
      `Cannot add reconnection steps for app '${app.key}': authenticationSteps is not set`,
    )
  }

  const updatedSteps = replaceCreateConnectionsWithUpdate(authenticationSteps)

  auth.reconnectionSteps = [resetConnectionStep, ...updatedSteps]

  return app
}

export default addReconnectionSteps
