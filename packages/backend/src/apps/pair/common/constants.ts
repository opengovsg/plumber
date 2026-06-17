export const PROMPT_PRESETS = [
  {
    key: 'summarise',
    label: 'Summarise',
    description: 'Pull out the key points and main takeaways',
  },
  {
    key: 'analyse',
    label: 'Analyse',
    description: 'Find patterns, strengths, and what to do next',
  },
  {
    key: 'categorise',
    label: 'Categorise',
    description: 'Group responses into themes or labels',
  },
  {
    key: 'write',
    label: 'Write',
    description: 'Generate content from a brief',
  },
] as const

/**
 * Default HTML prompt templates for Pair presets.
 *
 * NOTE:
 * The editor currently normalizes input by converting every `\n` into `<br>`.
 * To avoid introducing unintended extra spacing in rich-text templates, we
 * store each preset as an array of HTML fragments and join them with `''`,
 * producing a single newline-free HTML string.
 *
 * This keeps the source readable while ensuring rendered output remains stable.
 */
export const DEFAULT_PROMPT_VALUES = {
  analyse: [
    '<p style="margin: 0;font-weight: bold;">Analyse the following content and provide insights on:</p>',
    '<p></p>',
    '<span ',
    'data-type="variable" ',
    'data-id="step.00000000-0000-0000-0000-000000000000.Replace this with the content to analyse" ',
    'data-label="Replace this with the content to analyse" ',
    'data-value>',
    '{{step.00000000-0000-0000-0000-000000000000.Replace this with the content to analyse}}',
    '</span>',
    '<p></p>',
    '<p style="margin: 0;font-weight: bold;">Focus on:</p>',
    '<p>- Key patterns or trends</p>',
    '<p>- Strengths and weaknesses</p>',
    '<p>- Implications or recommendations</p>',
    '<p>- Supporting evidence for your conclusions</p>',
    '<p></p>',
    '<p style="margin: 0;font-weight: bold;">',
    'Present your analysis in a structured format with clear reasoning.',
    '</p>',
  ].join(''),

  categorise: [
    '<p>Categorise the following content into relevant groups or themes:</p>',
    '<p></p>',
    '<p>',
    '<span ',
    'data-type="variable" ',
    'data-id="step.00000000-0000-0000-0000-000000000000.Replace this with the content to categorise" ',
    'data-label="Replace this with the content to categorise" ',
    'data-value>',
    '{{step.00000000-0000-0000-0000-000000000000.Replace this with the content to categorise}}',
    '</span>',
    '</p>',
    '<p></p>',
    '<p>Provide clear category labels and explain your reasoning for each grouping.</p>',
  ].join(''),

  summarise: [
    '<p>Summarise the following content, highlighting the key points and main takeaways:</p>',
    '<p></p>',
    '<p>',
    '<span ',
    'data-type="variable" ',
    'data-id="step.00000000-0000-0000-0000-000000000000.Replace this with the content to summarise" ',
    'data-label="Replace this with the content to summarise" ',
    'data-value>',
    '{{step.00000000-0000-0000-0000-000000000000.Replace this with the content to summarise}}',
    '</span>',
    '</p>',
    '<p></p>',
    '<p>Focus on the most important information and present it in a clear, concise format.</p>',
  ].join(''),

  write: [
    '<p>',
    'Write ',
    '<span ',
    'data-type="variable" ',
    'data-id="step.00000000-0000-0000-0000-000000000000.Replace this with the content to write" ',
    'data-label="Replace this with the content to write" ',
    'data-value>',
    '{{step.00000000-0000-0000-0000-000000000000.Replace this with the content to write}}',
    '</span>',
    ' based on the following requirements:',
    '</p>',
    '<p></p>',
    '<p><strong>Topic/Subject</strong>: [Specify topic]</p>',
    '<p><strong>Purpose</strong>: [Explain the intended use]</p>',
    '<p><strong>Audience</strong>: [Describe target audience]</p>',
    '<p><strong>Tone</strong>: [Professional/Formal/Conversational]</p>',
    '<p><strong>Length</strong>: [Specify word count or length]</p>',
    '<p><strong>Additional requirements</strong>: [Any specific guidelines or constraints]</p>',
  ].join(''),

  custom: `<p>Enter your custom prompt</p>`,
}

export const DEFAULT_RESPONSE_FIELDS_VALUES = {
  analyse: [
    { fieldType: 'text', fieldNameHint: 'key patterns or trends' },
    { fieldType: 'text', fieldNameHint: 'strength' },
    { fieldType: 'text', fieldNameHint: 'weakness' },
    { fieldType: 'text', fieldNameHint: 'implications or recommendations' },
    {
      fieldType: 'text',
      fieldNameHint: 'supporting evidence for your conclusions',
    },
  ],
  categorise: [
    {
      fieldType: 'category',
      fieldNameHint: 'sentiment',
      fieldCategoriesHint: 'Positive, Negative, Neutral',
    },
  ],
  summarise: [{ fieldType: 'text', fieldNameHint: 'summary' }],
  write: [
    { fieldType: 'text', fieldNameHint: 'title' },
    { fieldType: 'text', fieldNameHint: 'content' },
  ],
  custom: [{ fieldType: 'text', fieldNameHint: 'response' }],
}
