import {
  IAction,
  IApp,
  IRawAction,
  IRawTrigger,
  ITrigger,
} from '@plumber/types'

import { cloneDeep, omit } from 'lodash'

import apps from '@/apps'

import addAuthenticationSteps from './add-authentication-steps'
import addReconnectionSteps from './add-reconnection-steps'

function stripFunctions<C>(data: C): C {
  return JSON.parse(JSON.stringify(data))
}

const getApp = (appKey: string, stripFuncs = true) => {
  let appData: IApp = cloneDeep(apps[appKey])

  if (appData.auth) {
    appData = addAuthenticationSteps(appData)
    appData = addReconnectionSteps(appData)
  }

  appData.triggers = appData?.triggers?.map((trigger: IRawTrigger) => {
    return addStaticSubsteps('trigger', appData, trigger) as ITrigger
  })

  appData.actions = appData?.actions?.map((action: IRawAction) => {
    return addStaticSubsteps('action', appData, action) as IAction
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
  const computedStep = omit(step, ['arguments']) as ITrigger | IAction

  computedStep.substeps = []

  if (appData.auth) {
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
