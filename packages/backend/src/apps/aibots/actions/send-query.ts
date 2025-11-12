import { IRawAction } from '@plumber/types'

const action: IRawAction = {
  name: 'Send Query',
  key: 'sendQuery',
  description: 'Sends a query to your customised AI Bot',
  arguments: [
    {
      label: 'Query',
      key: 'query',
      type: 'rich-text' as const,
      required: true,
      variables: true,
      returnMarkdown: true,
    },
  ],

  async run($) {
    const query = $.step.parameters.query

    // TODO: add the actual API call here
    const formData = new FormData()
    formData.append('query', query)

    $.setActionItem({
      raw: {
        query,
      },
    })
  },
}

export default action
