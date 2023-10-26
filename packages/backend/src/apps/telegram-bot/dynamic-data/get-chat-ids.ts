import { DynamicDataOutput, IGlobalVariable } from '@plumber/types'

import defineDynamicData from '@/helpers/define-dynamic-data'

const getUpdatesApi = '/getUpdates'

type ChatInfo = {
  title: string
  id: string
}

function extractChatFromUpdate(update: any): ChatInfo {
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
  async run($: IGlobalVariable): Promise<DynamicDataOutput> {
    const chatIdsMap: { name: string; value: string }[] = []
    const chatIdsSet = new Set<string>()
    try {
      const { data }: { data: TelegramGetUpdatesResponse } = await $.http.get(
        getUpdatesApi,
      )

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
})

// Reference: https://core.telegram.org/bots/api#user
type TelegramUser = {
  id: number
  is_bot: boolean
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: true
  added_to_attachment_menu?: true
  can_join_groups?: boolean
  can_read_all_group_messages?: boolean
  supports_inline_queries?: boolean
}

// Reference: https://core.telegram.org/bots/api#chatphoto
type TelegramChatPhoto = {
  small_file_id: string
  small_file_unique_id: string
  big_file_id: string
  big_file_unique_id: string
}

// Reference: https://core.telegram.org/bots/api#chatpermissions
type TelegramChatPermissions = {
  can_send_messages?: boolean
  can_send_audios?: boolean
  can_send_documents?: boolean
  can_send_photos?: boolean
  can_send_videos?: boolean
  can_send_video_notes?: boolean
  can_send_voice_notes?: boolean
  can_send_polls?: boolean
  can_send_other_messages?: boolean
  can_add_web_page_previews?: boolean
  can_change_info?: boolean
  can_invite_users?: boolean
  can_pin_messages?: boolean
  can_manage_topics?: boolean
}

// Reference: https://core.telegram.org/bots/api#location
type TelegramLocation = {
  longitude: number
  latitude: number
  horizontal_accuracy?: number
  live_period?: number
  heading?: number
  proximity_alert_radius?: number
}

// Reference: https://core.telegram.org/bots/api#chatlocation
type TelegramChatLocation = {
  location: TelegramLocation
  address: string
}

// Reference: https://core.telegram.org/bots/api#chat
type TelegramChat = {
  id: number
  type: string
  title?: string
  username?: string
  first_name?: string
  last_name?: string
  is_forum?: true
  photo?: TelegramChatPhoto
  active_usernames?: Array<string>
  emoji_status_custom_emoji_id?: string
  emoji_status_expiration_date?: number
  bio?: string
  has_private_forwards?: true
  has_restricted_voice_and_video_messages?: true
  join_to_send_messages?: true
  join_by_request?: true
  description?: string
  invite_link?: string
  pinned_message?: TelegramMessage
  permissions?: TelegramChatPermissions
  slow_mode_delay?: number
  message_auto_delete_time?: number
  has_aggressive_anti_spam_enabled?: true
  has_hidden_members?: true
  has_protected_content?: true
  sticker_set_name?: string
  can_set_sticker_set?: true
  linked_chat_id?: number
  location?: TelegramChatLocation
}

// Reference: https://core.telegram.org/bots/api#message
type TelegramMessage = {
  message_id: number
  message_thread_id?: number
  from?: TelegramUser
  sender_chat?: TelegramChat
  date: number
  chat: TelegramChat
  forward_from?: TelegramUser
  forward_from_chat?: TelegramChat
  forward_from_message_id?: number
  forward_signature?: string
  forward_sender_name?: string
  forward_date?: number
  is_topic_message?: true
  is_automatic_forward?: true
  reply_to_message?: TelegramMessage
  via_bot?: TelegramUser
  edit_date?: number
  has_protected_content?: true
  media_group_id?: string
  author_signature?: string
  text?: string
  // ... even more fields
}

// Reference: https://core.telegram.org/bots/api#update
type TelegramUpdate = {
  update_id: number
  message?: TelegramMessage
  edited_message?: TelegramMessage
  channel_post?: TelegramMessage
  edited_channel_post?: TelegramMessage
  inline_query?: unknown
  chosen_inline_result?: unknown
  callback_query?: unknown
  shipping_query?: unknown
  pre_checkout_query?: unknown
  poll?: unknown
  poll_answer?: unknown
  my_chat_member?: unknown
  chat_member?: unknown
  chat_join_request?: unknown
}

type TelegramGetUpdatesResponse = {
  ok: true
  result: Array<TelegramUpdate>
}

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
