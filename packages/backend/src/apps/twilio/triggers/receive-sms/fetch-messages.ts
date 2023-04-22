import { IGlobalVariable } from '@plumber/types'

const fetchMessages = async ($: IGlobalVariable) => {
  const toNumber = $.step.parameters.toNumber as string

  let response
  let requestPath = `/2010-04-01/Accounts/${$.auth.data.accountSid}/Messages.json?To=${toNumber}`

  do {
    response = await $.http.get(requestPath)

    for (const message of response.data.messages) {
      const dataItem = {
        raw: message,
        meta: {
          internalId: message.date_sent as string,
        },
      }
      await $.pushTriggerItem(dataItem)
    }

    requestPath = response.data.next_page_uri
  } while (requestPath)
}

export default fetchMessages
