import {
  DynamicDataOutput,
  IDynamicData,
  IGlobalVariable,
} from '@plumber/types'

import {
  HasTelegramChat,
  TelegramGetUpdatesResponse,
  TelegramUpdate,
} from './types'

const getUpdatesApi = '/getUpdates'

type ChatInfo = {
  title: string
  id: number
}

function extractChatFromUpdate(update: TelegramUpdate): ChatInfo {
  const messageObject: HasTelegramChat =
    update.message ||
    update.my_chat_member ||
    update.channel_post ||
    update.chat_member ||
    update.edited_channel_post ||
    update.edited_message

  if (!messageObject) {
    return null
  }
  const chatObject = messageObject.chat
  if (!chatObject) {
    return null
  }
  const { title, username, type, id } = chatObject

  if (!id || !(title || username)) {
    return null
  }
  const name = `${title || username} (${type})`
  return { title: name || username, id }
}

const dynamicData: IDynamicData = {
  key: 'getTelegramChatIds',
  name: 'Get Telegram Chat IDs',
  async run($: IGlobalVariable): Promise<DynamicDataOutput> {
    const chatIdsMap: { name: string; value: string }[] = []
    const chatIdsSet = new Set<number>()
    try {
      const { data } = await $.http.get<TelegramGetUpdatesResponse>(
        getUpdatesApi,
      )

      if (!data.result) {
        return {
          data: [],
        }
      }
      data.result.reverse().forEach((update) => {
        const chat = extractChatFromUpdate(update)
        if (!chat) {
          return
        }
        if (chatIdsSet.has(chat.id)) {
          return
        }
        chatIdsSet.add(chat.id)
        chatIdsMap.push({
          name: chat.title,
          value: chat.id.toString(),
        })
      })
      return { data: chatIdsMap }
    } catch (e) {
      return {
        data: [],
        error: e.message,
      }
    }
  },
}

export default dynamicData
