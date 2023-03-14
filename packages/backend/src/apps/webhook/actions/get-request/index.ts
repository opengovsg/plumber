import defineAction from '../../../../helpers/define-action'

export default defineAction({
  name: 'Get Request',
  key: 'webhook-get',
  description: 'Makes a get request',
  arguments: [
    {
      label: 'API URL',
      key: 'apiUrl',
      type: 'string' as const,
      required: true,
      description: 'URL to make the request to.',
      variables: true,
    },
    {
      label: 'Headers',
      key: 'headers',
      type: 'string' as const,
      required: false,
      description: 'Headers to attach to the request, in JSON format.',
      variables: false,
    },
  ],

  async run($) {
    const { apiUrl, headers } = $.step.parameters

    let parsedHeaders = {}
    if (headers) {
      try {
        parsedHeaders = JSON.parse(headers.toString())
      } catch (err) {
        throw new Error('Headers must be valid JSON.')
      }
    }

    const response = await $.http.get(apiUrl.toString(), {
      headers: parsedHeaders,
    })

    const body = response.data

    try {
      JSON.parse(JSON.stringify(body))
    } catch (e) {
      throw new Error('Only supports json response body')
    }

    $.setActionItem({ raw: body })
  },
})
