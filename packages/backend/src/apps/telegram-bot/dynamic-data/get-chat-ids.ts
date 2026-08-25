import {
  DynamicDataOutput,
  IDynamicData,
  IGlobalVariable,
} from '@plumber/types'

import { z } from 'zod'

import HttpError from '@/errors/http'
import logger from '@/helpers/logger'

import {
  HasTelegramChat,
  TelegramGetUpdatesResponse,
  TelegramUpdate,
} from './types'

const getUpdatesApi = '/getUpdates'

export const UPDATES_CONFLICT_MESSAGE =
  'Another service receives the updates for this bot, so Plumber cannot list its chats. Type the chat ID in this field.'

const telegramErrorSchema = z.object({ description: z.string() })

function getErrorMessage(e: unknown): string {
  if (e instanceof HttpError) {
    // Telegram returns 409 when a webhook or another client owns the bot's updates.
    if (e.response?.status === 409) {
      return UPDATES_CONFLICT_MESSAGE
    }
    const parsed = telegramErrorSchema.safeParse(e.response?.data)
    if (parsed.success) {
      return parsed.data.description
    }
  }
  return e instanceof Error ? e.message : 'Unknown error'
}

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
      const { data, request } = await $.http.get<TelegramGetUpdatesResponse>(
        getUpdatesApi,
      )
      // logging for debugging
      logger.info(`Telegram ip success: ${request?.socket?.remoteAddress}`)

      if (!data.result) {
        return {
          data: [],
        }
      }
      data.result.reverse().forEach((update: TelegramUpdate) => {
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
        error: { message: getErrorMessage(e) },
      }
    }
  },
}

export default dynamicData
