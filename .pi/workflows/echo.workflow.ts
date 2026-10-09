import { agent, defineWorkflow } from '@osolmaz/pi-workflows'

export default defineWorkflow({
  name: 'echo',
  startAt: 'reply',
  nodes: {
    reply: agent({
      prompt: ({ input }) =>
        `Answer concisely: ${(input as { task?: string }).task}`,
      expectedOutput: `{ "reply": "your concise answer" }`,
    }),
  },
  edges: [],
})
