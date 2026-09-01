import { AnnouncementItemProps } from './AnnouncementItem'

// Module-level loaders so LazyLottieAnimation gets stable function identities.
const loadAiBuilderV2Animation1 = () =>
  import('./assets/ai_builder_v2_1.json').then((m) => m.default)
const loadAiBuilderV2Animation2 = () =>
  import('./assets/ai_builder_v2_2.json').then((m) => m.default)
const loadAiBuilderV2Animation3 = () =>
  import('./assets/ai_builder_v2_3.json').then((m) => m.default)

export const ANNOUNCEMENT_ITEM_LIST: AnnouncementItemProps[] = [
  {
    title: 'Describe your workflow and AI Builder builds it',
    details:
      'Say what you want to happen in plain English. It now fills in the step fields too, not just the outline, so you get a working pipe rather than a starting point.',
    multimedia: {
      animationDataLoader: loadAiBuilderV2Animation1,
    },
  },
  {
    title: 'Already have a FormSG form? Start there',
    details:
      'Paste your form link and AI Builder suggests what you could automate with it. Pick one and it builds the pipe for you.',
    multimedia: {
      animationDataLoader: loadAiBuilderV2Animation2,
    },
  },
  {
    title: "Check it, then publish when you're ready",
    details:
      'The preview is the real editor, so you can see exactly what AI Builder filled in, down to the variable pills and field labels. Nothing runs until you publish.',
    multimedia: {
      animationDataLoader: loadAiBuilderV2Animation3,
    },
  },
]
