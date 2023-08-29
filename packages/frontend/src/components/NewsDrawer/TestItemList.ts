// This file is for test data
import dedent from 'dedent'

import TestLottieAnimation from './assets/Lottie-Lego.json'
import { NewsItemProps } from './NewsItem'
import { NEW_FEATURE_TAG, NEW_FIX_TAG } from './NewsItemTag'

// to dump into another file if there are too many links
const TEST_EXTERNAL_LINK = 'https://guide.plumber.gov.sg/'
const TEST_INTERNAL_LINK = '/executions'

export const TEST_ITEM_LIST: NewsItemProps[] = [
  {
    date: '2023-08-17',
    tag: NEW_FIX_TAG,
    title: 'Test animation',
    details: `This is a lottie test animation`,
    multimedia: {
      animationData: TestLottieAnimation,
    },
  },
  {
    date: '2023-08-14',
    tag: NEW_FEATURE_TAG,
    title: 'Test external link - opens a new tab',
    details: `Welcome to Plumber. [Learn more through our guide!](${TEST_EXTERNAL_LINK})`,
  },
  {
    date: '2023-08-12',
    tag: NEW_FEATURE_TAG,
    title: 'Test internal link and random image',
    details: `Welcome to Plumber. [Click here to view your executions](${TEST_INTERNAL_LINK})`,
    multimedia: {
      url: 'https://picsum.photos/500/500',
    },
  },
  {
    date: '2023-08-11',
    tag: NEW_FEATURE_TAG,
    title: 'Test nested lists',
    details: dedent`
      1. This is the *first* item!
      2. This is the **second** item!
      3. This is the ~third~ item!
          * Nested bullet point 1
          * Nested bullet point 2
      4. This is the fourth item!
    `,
  },
  {
    date: '2023-07-29',
    tag: NEW_FEATURE_TAG,
    title: 'Test code block',
    details: dedent`
      ~~~
      const str = 'Hello World'
      console.log(str)
      ~~~
    `,
  },
  {
    date: '2023-07-03',
    tag: NEW_FEATURE_TAG,
    title: 'Test line breaks',
    details: dedent`
      What is Plumber? Plumber is a no-code workflow tool that helps you to connect multiple applications to automate your repetitive tasks.


      What is our vision? Plumber's vision is to empower you to automate processes without a developer, reduce tedious tasks and eliminate human error, so you can focus on your most important work.
      
      Stay tuned for more!
    `,
  },
]
