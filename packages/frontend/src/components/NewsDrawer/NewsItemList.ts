import dedent from 'dedent'

import { NewsItemProps } from './NewsItem'
import { NEW_ENHANCEMENT_TAG, NEW_FEATURE_TAG } from './NewsItemTag'

export const NEWS_ITEM_LIST: NewsItemProps[] = [
  {
    date: '2023-10-11',
    tag: NEW_FEATURE_TAG,
    title: `Introducing Toolbox`,
    details: dedent`
      Toolbox is a new app that you can find when you add an action. This will contain built in tools that can enhance your workflows! Logic has been moved into Toolbox and renamed to **Only continue if**. Stay tuned for the release of our new feature **If... Then** in the coming weeks!
    `,
  },
  {
    date: '2023-10-11',
    tag: NEW_ENHANCEMENT_TAG,
    title: `Enhancements this week!`,
    details: dedent`
      * Email notifications for pipe failures
          * Sent on the first failed execution for a pipe
          * You will only receive a maximum of 1 per day per pipe
      

      * Variable values are now displayed
          * Values will now be shown in the pill together with the variable name
    `,
  },
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
