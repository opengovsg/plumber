import {
  DynamicDataOutput,
  IDynamicData,
  IGlobalVariable,
} from '@plumber/types'

import {
  ForumTopic,
  TelegramGetUpdatesResponse,
  TelegramMessage,
  TelegramUpdate,
} from './types'

const getUpdatesApi = '/getUpdates'

type TopicInfo = {
  name: string
  id: number
}

function extractTopicFromUpdate(update: TelegramUpdate): TopicInfo {
  const messageObject: TelegramMessage =
    update.message?.reply_to_message || // replies in the same chat and message thread take priority
    update?.message ||
    update?.channel_post ||
    update?.edited_channel_post ||
    update?.edited_message

  // only supergroup will have this
  if (!messageObject || !messageObject?.message_thread_id) {
    return null
  }
  const forumTopic: ForumTopic =
    messageObject?.forum_topic_created || messageObject?.forum_topic_edited

  return { name: forumTopic.name, id: messageObject.message_thread_id }
}

const dynamicData: IDynamicData = {
  key: 'getTelegramTopicIds',
  name: 'Get Telegram Topic IDs',
  async run($: IGlobalVariable): Promise<DynamicDataOutput> {
    const topicIdsMap: { name: string; value: string }[] = []
    const topicIdsSet = new Set<number>()
    try {
      const { data } = await $.http.get<TelegramGetUpdatesResponse>(
        getUpdatesApi,
      )
      // NOTE: no way to find all the topic ids now, so cannot detect if a topic is deleted (24h update)
      if (!data.result) {
        return {
          data: [],
        }
      }
      data.result.reverse().forEach((update) => {
        const topic = extractTopicFromUpdate(update)
        if (!topic) {
          return
        }
        if (topicIdsSet.has(topic.id)) {
          return
        }
        topicIdsSet.add(topic.id)
        topicIdsMap.push({
          name: topic.name,
          value: topic.id.toString(),
        })
      })
      return { data: topicIdsMap }
    } catch (e) {
      return {
        data: [],
        error: e.message,
      }
    }
  },
}

export default dynamicData
