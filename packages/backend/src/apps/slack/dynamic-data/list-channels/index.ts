import {
  DynamicDataOutput,
  IDynamicData,
  IGlobalVariable,
} from '@plumber/types'

import logger from '@/helpers/logger'

interface SlackConversation {
  id: string
  name: string
  is_channel: boolean
  is_archived: boolean
}

interface ListChannelResponse {
  ok: boolean
  channels: Array<SlackConversation>
  response_metadata?: {
    next_cursor: string
  }
}

// we want to limit the number of pages the API traverses to prevent rate limits or timeouts
const MAX_PAGES = 4

const dynamicData: IDynamicData = {
  name: 'List channels',
  key: 'listChannels',

  async run($: IGlobalVariable): Promise<DynamicDataOutput> {
    const result: DynamicDataOutput = {
      data: [],
      error: null,
    }

    let cursor: string | undefined
    let pages = 0

    do {
      const { data } = await $.http
        .get<ListChannelResponse>('/conversations.list', {
          params: {
            exclude_archived: true,
            // do not add private_channel to this list as it will return a lot of channels
            // and cause this dynamic data api to timeout. instead, we allow the user to
            // manually enter the private channel ID
            types: 'public_channel',
            limit: 1000,
            cursor,
          },
        })
        .catch((error) => {
          logger.error(error)
          throw new Error('Failed to list channels')
        })

      if (data.ok === false) {
        logger.error(data)
        throw new Error('Failed to list channels')
      }

      cursor = data.response_metadata?.next_cursor

      const channels = data.channels.map((channel) => {
        return {
          value: channel.id,
          name: channel.name,
        }
      })

      result.data.push(...channels)
      pages++
    } while (cursor && pages < MAX_PAGES)

    return result
  },
}

export default dynamicData
