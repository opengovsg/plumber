import type { IAuthenticationStep, IJSONObject } from '@plumber/types'

import apolloClient from 'graphql/client'
import MUTATIONS from 'graphql/mutations'

enum AuthenticationSteps {
  Mutation = 'mutation',
  OpenWithPopup = 'openWithPopup',
}

const processMutation = async (
  step: IAuthenticationStep,
  variables: IJSONObject,
) => {
  const mutation = MUTATIONS[step.name]
  const mutationResponse = await apolloClient.mutate({
    mutation,
    variables: { input: variables },
    context: {
      autoSnackbar: false,
    },
  })
  const responseData = mutationResponse.data[step.name]

  return responseData
}

const parseUrlSearchParams = (event: any) => {
  const searchParams = new URLSearchParams(event.data.payload)

  return getObjectOfEntries(searchParams.entries())
}

function getObjectOfEntries(iterator: any) {
  const result: any = {}

  for (const [key, value] of iterator) {
    result[key] = value
  }

  return result
}

const processOpenWithPopup = (
  step: IAuthenticationStep,
  variables: IJSONObject,
) => {
  return new Promise((resolve, reject) => {
    const windowFeatures =
      'toolbar=no, titlebar=no, menubar=no, width=500, height=700, top=100, left=100'
    const url = variables.url

    const popup = window.open(
      url as string,
      '_blank',
      windowFeatures,
    ) as WindowProxy
    popup?.focus()

    const closeCheckIntervalId = setInterval(() => {
      if (popup.closed) {
        clearInterval(closeCheckIntervalId)
        reject({ message: 'Error occured while verifying credentials!' })
      }
    }, 1000)

    const messageHandler = async (event: MessageEvent) => {
      if (
        event.data.source !== 'plumber' ||
        // if message source is from a different origin, reject
        event.origin !== window.location.origin ||
        // event source should be the same reference as popup window
        event.source !== popup
      ) {
        return
      }

      // close the popup after receving the message
      popup?.close()

      const data = parseUrlSearchParams(event)
      window.removeEventListener('message', messageHandler)

      clearInterval(closeCheckIntervalId)
      resolve(data)
    }

    window.addEventListener('message', messageHandler, false)
  })
}

export const processStep = async (
  step: IAuthenticationStep,
  variables: IJSONObject,
): Promise<any> => {
  if (step.type === AuthenticationSteps.Mutation) {
    return processMutation(step, variables)
  } else if (step.type === AuthenticationSteps.OpenWithPopup) {
    return processOpenWithPopup(step, variables)
  }
}
