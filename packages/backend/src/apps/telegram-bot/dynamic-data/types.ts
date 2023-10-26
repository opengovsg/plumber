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

// Reference: https://core.telegram.org/bots/api#chat
type TelegramChat = {
  id: number
  type: 'private' | 'group' | 'supergroup' | 'channel'
  title?: string
  username?: string
  first_name?: string
  last_name?: string
  photo?: unknown
}

export type HasTelegramChat = {
  chat: TelegramChat
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
}

// Reference: https://core.telegram.org/bots/api#update
export type TelegramUpdate = {
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
  my_chat_member?: HasTelegramChat
  chat_member?: HasTelegramChat
  chat_join_request?: unknown
}

export type TelegramGetUpdatesResponse = {
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
