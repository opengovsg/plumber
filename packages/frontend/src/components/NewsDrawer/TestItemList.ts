// This file is for test data
import dedent from 'dedent'

import { NewsItemProps } from './NewsItem'

import TestLottieAnimation from './assets/Lottie-Lego.json'

// to dump into another file if there are too many links
const TEST_EXTERNAL_LINK = 'https://plumber.gov.sg/'
const TEST_INTERNAL_LINK = 'http://localhost:3001/executions'

export const TEST_ITEM_LIST: NewsItemProps[] = [
  {
    date: new Date('16 Aug 2023 11:00:30 GMT+8'),
    title: 'Test animation',
    details: `This is a lottie test animation`,
    multimedia: {
      animationData: TestLottieAnimation,
      alt: 'Animation...',
    },
  },
  {
    date: new Date('14 Aug 2023 12:00:30 GMT+8'),
    title: 'Test external link - opens a new tab',
    details: `Welcome to Plumber. [Learn more](${TEST_EXTERNAL_LINK})`,
  },
  {
    date: new Date('12 Aug 2023 GMT+8'),
    title: 'Test internal link and random image',
    details: `Welcome to Plumber. [Learn more about executions](${TEST_INTERNAL_LINK})`,
    multimedia: {
      url: 'https://picsum.photos/500/500',
      alt: 'Random image from lorem picsum',
    },
  },
  {
    date: new Date('11 Aug 2023 GMT+8'),
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
    date: new Date('8 Aug 2023 GMT+8'),
    title: 'Test code block',
    details: dedent`
      ~~~
      const str = 'Hello World'
      console.log(str)
      ~~~
    `,
  },
  {
    date: new Date('3 Aug 2023 GMT+8'),
    title: 'Test line breaks',
    details: dedent`
      What is Plumber? Plumber is a no-code workflow tool that helps you to connect multiple applications to automate your repetitive tasks.
      &nbsp; \n
      &nbsp; \n
      What is our vision? Plumber's vision is to empower you to automate processes without a developer, reduce tedious tasks and eliminate human error, so you can focus on your most important work.
      &nbsp; \n &nbsp; \n &nbsp; \n
      Stay tuned for more!
    `,
  },
]
