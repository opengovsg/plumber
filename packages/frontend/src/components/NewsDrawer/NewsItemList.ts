import dedent from 'dedent'

import { NewsItemProps } from './NewsItem'

export const NEWS_ITEM_LIST: NewsItemProps[] = [
  {
    date: '2023-08-29',
    title: 'Welcome to Plumber',
    details: dedent`
      * Users can now ...
      * Users cannot ...
    `,
  },
]
