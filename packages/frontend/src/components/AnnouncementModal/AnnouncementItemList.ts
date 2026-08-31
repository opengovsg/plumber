import aiBuilderV2Animation1 from './assets/ai_builder_v2_1.json'
import aiBuilderV2Animation2 from './assets/ai_builder_v2_2.json'
import aiBuilderV2Animation3 from './assets/ai_builder_v2_3.json'
import { AnnouncementItemProps } from './AnnouncementItem'

// TODO: add a `multimedia` image/animation to each item once the AI Builder
// screenshots are hosted (see NewsItemList for the file.go.gov.sg convention).
export const ANNOUNCEMENT_ITEM_LIST: AnnouncementItemProps[] = [
  {
    title: 'Describe your workflow and AI Builder builds it',
    details:
      'Say what you want to happen in plain English. It now fills in the step fields too, not just the outline, so you get a working pipe rather than a starting point.',
    multimedia: {
      animationData: aiBuilderV2Animation1,
    },
  },
  {
    title: 'Already have a FormSG form? Start there',
    details:
      'Paste your form link and AI Builder suggests what you could automate with it. Pick one and it builds the pipe for you.',
    multimedia: {
      animationData: aiBuilderV2Animation2,
    },
  },
  {
    title: "Check it, then publish when you're ready",
    details:
      'The preview is the real editor, so you can see exactly what AI Builder filled in, down to the variable pills and field labels. Nothing runs until you publish.',
    multimedia: {
      animationData: aiBuilderV2Animation3,
    },
  },
]
