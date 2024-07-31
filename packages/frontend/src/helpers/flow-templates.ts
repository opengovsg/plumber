import type {
  CreateTemplatedFlowInput,
  DemoVideoDetails,
} from '@/graphql/__generated__/graphql'

export const FORMSG_POSTMAN_TEMPLATE = 'formsg-postman'

// This is to map from the backend config to the video content, so we can modify it here
// instead of needing to modify the db data unnecessarily
export const DEMO_VIDEOS_MAP: Record<string, DemoVideoDetails> = {
  [FORMSG_POSTMAN_TEMPLATE]: {
    url: 'https://demo.arcade.software/FzpL1zCmibw0oXR6HUJi?embed&show_copy_link=true',
    title: 'Send notifications',
  },
}

export const FLOW_TEMPLATES_MAP: Record<string, CreateTemplatedFlowInput> = {
  [FORMSG_POSTMAN_TEMPLATE]: {
    flowName: 'Send notifications',
    trigger: {
      appKey: 'formsg',
      eventKey: 'newSubmission',
    },
    actions: [
      {
        appKey: 'postman',
        eventKey: 'sendTransactionalEmail',
      },
    ],
    demoVideoId: FORMSG_POSTMAN_TEMPLATE,
  },
}
