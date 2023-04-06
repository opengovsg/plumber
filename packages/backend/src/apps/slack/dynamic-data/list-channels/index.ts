import { IGlobalVariable, IJSONObject } from '@plumber/types'

export default {
  name: 'List channels',
  key: 'listChannels',

  async run($: IGlobalVariable) {
    const channels: {
      data: IJSONObject[]
      error: IJSONObject | null
    } = {
      data: [],
      error: null,
    }

    const response = await $.http.get('/conversations.list', {
      params: {
        exclude_archived: true,
        types: 'public_channel',
        limit: 1000,
      },
    })

    if (response.data.ok === false) {
      throw new Error(response.data)
    }

    channels.data = response.data.channels.map((channel: IJSONObject) => {
      return {
        value: channel.id,
        name: channel.name,
      }
    })

    return channels
  },
}
