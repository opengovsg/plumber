import { DynamicData, IGlobalVariable } from '@plumber/types'

import defineDynamicData from '@/helpers/define-dynamic-data'

const getUpdatesApi = '/getUpdates'

function extractChatFromUpdate(update: any) {
  const messageObject =
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

  // type can be channel, private or group

  if (!id || !(title || username)) {
    return null
  }
  const name = `${title || username} (${type})`
  return { title: name || username, id }
}

export default defineDynamicData({
  key: 'getTelegramChatIds',
  name: 'Get Telegram Chat IDs',
  async run($: IGlobalVariable): Promise<DynamicData> {
    const chatIdsMap: { name: string; value: string }[] = []
    const chatIdsSet = new Set<string>()
    try {
      const { data } = await $.http.get(getUpdatesApi)
      if (!data.result) {
        return {
          data: [],
        }
      }
      data.result.reverse().forEach((update: any) => {
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
          value: chat.id,
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
})

// Reference: https://core.telegram.org/bots/api#getupdates
// Sample response:
// {
//   "ok": true,
//   "result": [
//     {
//       "update_id": 123123,
//       "message": {
//         "message_id": 123,
//         "from": ...
//         "chat": {
//           "id": 345345345,
//           "title": "test",
//           "type": "group",
//           "all_members_are_administrators": true
//         },
//         "date": ...,
//         "text": "/invite @get_id_bot",
//         "entities": ...
//       }
//     },
//     {
//       "update_id": 123,
//       "my_chat_member": {
//         "chat": {
//           "id": -100123123123123,
//           "title": "teete",
//           "type": "channel"
//         },
//         "from": { ... },
//         "date": ...,
//         "old_chat_member": {...},
//         "new_chat_member": {...}
//       }
//     }
//   ]
// }
