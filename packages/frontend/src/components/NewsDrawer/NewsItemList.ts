import dedent from 'dedent'

import { NewsItemProps } from './NewsItem'
import { NEW_FEATURE_TAG } from './NewsItemTag'

export const NEWS_ITEM_LIST: NewsItemProps[] = [
  {
    date: '2023-08-29',
    tag: NEW_FEATURE_TAG,
    title: 'Welcome to Plumber',
    details: dedent`
      * Users can now ...
      * Users cannot ...
    `,
  },
]
