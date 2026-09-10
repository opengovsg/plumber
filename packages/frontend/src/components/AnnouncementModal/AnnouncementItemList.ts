import { AnnouncementItemProps } from './AnnouncementItem'
import aiBuilderV2Video1 from './assets/ai_builder_v2_1.mp4'
import aiBuilderV2Video2 from './assets/ai_builder_v2_2.mp4'
import aiBuilderV2Video3 from './assets/ai_builder_v2_3.mp4'

export const ANNOUNCEMENT_ITEM_LIST: AnnouncementItemProps[] = [
  {
    title: 'Describe your workflow and AI Builder builds it',
    details:
      'Say what you want to happen in plain English. It now fills in the step fields too, not just the outline, so you get a working pipe rather than a starting point.',
    multimedia: {
      videoSrc: aiBuilderV2Video1,
    },
  },
  {
    title: 'Already have a FormSG form? Start there',
    details:
      'Paste your form link and AI Builder suggests what you could automate with it. Pick one and it builds the pipe for you.',
    multimedia: {
      videoSrc: aiBuilderV2Video2,
    },
  },
  {
    title: "Check it, then publish when you're ready",
    details:
      'The preview is the real editor, so you can see exactly what AI Builder filled in, down to the variable pills and field labels. Nothing runs until you publish.',
    multimedia: {
      videoSrc: aiBuilderV2Video3,
    },
  },
]
