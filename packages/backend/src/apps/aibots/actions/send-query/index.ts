import { IRawAction } from '@plumber/types'

import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import HttpError from '@/errors/http'
import StepError, { GenericSolution } from '@/errors/step'

import getDataOutMetadata from './get-data-out-metadata'
import { parametersSchema } from './schema'

const action: IRawAction = {
  name: 'Send Query',
  key: 'sendQuery',
  description: 'Sends a query to your customised AI Bot',
  arguments: [
    {
      label: 'Bot API key',
      key: 'apiKey',
      description: 'Enter the API key for your bot',
      type: 'string' as const,
      required: true,
      variables: false,
    },
    {
      label: 'Query',
      key: 'query',
      type: 'string' as const,
      required: true,
      variables: true,
    },
  ],

  getDataOutMetadata,

  async run($) {
    try {
      const parameters = parametersSchema.parse($.step.parameters)

      const { query, apiKey } = parameters

      const headers = { 'X-ATLAS-Key': apiKey }

      // create a new chat
      const response = await $.http.post(
        `/chats`,
        { name: 'Chat from Plumber' },
        { headers },
      )

      // /chats/:chatId/messages requires FormData
      const chatId = response.data.id
      const formData = new FormData()
      formData.append('content', query)

      // send the query and get the response
      const chatResponse = await $.http.post(
        `/chats/:chatId/messages`,
        formData,
        {
          headers,
          urlPathParams: { chatId },
        },
      )

      $.setActionItem({
        raw: {
          data: chatResponse.data,
        },
      })
    } catch (error) {
      // if the user enters an invalid API key, aibots will return a 401 error
      if (error instanceof HttpError && error.response.status === 401) {
        throw new StepError(
          'Invalid API key',
          'Please check that you have entered a valid API key',
          $.step.position,
          $.app.name,
        )
      }

      if (error instanceof ZodError) {
        const firstError = fromZodError(error).details[0]

        throw new StepError(
          `${firstError.message} under set up step`,
          GenericSolution.ReconfigureInvalidField,
          $.step.position,
          $.app.name,
        )
      }

      throw error
    }
  },
}

export default action
