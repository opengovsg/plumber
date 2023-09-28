import dedent from 'dedent'

import { NewsItemProps } from './NewsItem'
import { NEW_ENHANCEMENT_TAG, NEW_FEATURE_TAG } from './NewsItemTag'

export const NEWS_ITEM_LIST: NewsItemProps[] = [
  {
    date: '2023-08-30',
    tag: NEW_FEATURE_TAG,
    title: `What's new on Plumber`,
    details: dedent`
      Stay updated on new features, bug fixes and enhancements through this drawer. 
      
      The Plumber team has been working hard to release some new features and improvements to your overall user experience so keep a look out for these!
    `,
  },
  {
    date: '2023-08-30',
    tag: NEW_ENHANCEMENT_TAG,
    title: `Automatic FormSG webhook configuration`,
    details: dedent`
      * Webhook URL is automatically set when you connect your form.
      * Save the hassle of navigating through FormSG.
    `,
  },
]
