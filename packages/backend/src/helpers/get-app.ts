import {
  IAction,
  IApp,
  IRawAction,
  IRawTrigger,
  ITrigger,
} from '@plumber/types'

import fs from 'fs'
import { cloneDeep, omit } from 'lodash'
import path from 'path'

import addAuthenticationSteps from './add-authentication-steps'
import addReconnectionSteps from './add-reconnection-steps'

type TApps = Record<string, Promise<{ default: IApp }>>
const apps = fs
  .readdirSync(path.resolve(__dirname, `../apps/`), { withFileTypes: true })
  .reduce((apps, dirent) => {
    if (!dirent.isDirectory()) {
      return apps
    }

    apps[dirent.name] = import(path.resolve(__dirname, '../apps', dirent.name))

    return apps
  }, {} as TApps)

async function getDefaultExport(appKey: string) {
  return (await apps[appKey]).default
}

function stripFunctions<C>(data: C): C {
  return JSON.parse(JSON.stringify(data))
}

const getApp = async (appKey: string, stripFuncs = true) => {
  let appData: IApp = cloneDeep(await getDefaultExport(appKey))

  if (appData.auth) {
    appData = addAuthenticationSteps(appData)
    appData = addReconnectionSteps(appData)
  }

  appData.triggers = appData?.triggers?.map((trigger: IRawTrigger) => {
    return addStaticSubsteps('trigger', appData, trigger)
  })

  appData.actions = appData?.actions?.map((action: IRawAction) => {
    return addStaticSubsteps('action', appData, action)
  })

  if (stripFuncs) {
    return stripFunctions(appData)
  }

  return appData
}

const chooseConnectionStep = {
  key: 'chooseConnection',
  name: 'Choose connection',
}

const testStep = (stepType: 'trigger' | 'action') => {
  return {
    key: 'testStep',
    name: stepType === 'trigger' ? 'Test trigger' : 'Test action',
  }
}

function addStaticSubsteps(
  stepType: 'trigger',
  appData: IApp,
  step: IRawTrigger,
): ITrigger
function addStaticSubsteps(
  stepType: 'action',
  appData: IApp,
  step: IRawAction,
): IAction
function addStaticSubsteps(
  stepType: 'trigger' | 'action',
  appData: IApp,
  step: IRawTrigger | IRawAction,
) {
  const computedStep: ITrigger | IAction = omit(step, ['arguments'])

  computedStep.substeps = []

  if (appData.supportsConnections) {
    computedStep.substeps.push(chooseConnectionStep)
  }

  if (step.arguments) {
    computedStep.substeps.push({
      key: 'chooseTrigger',
      name: stepType === 'trigger' ? 'Set up a trigger' : 'Set up action',
      arguments: step.arguments,
    })
  }

  computedStep.substeps.push(testStep(stepType))

  return computedStep
}

export default getApp
